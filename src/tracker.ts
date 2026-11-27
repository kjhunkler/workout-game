import type { Pose } from "./types";
import {
  CameraFailure,
  type CameraOptions,
  type CameraStage,
  CameraDiagnostics,
  defaultCameraOptions,
} from "./camera-diagnostics";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

export class Tracker {
  private worker?: Worker;
  private detector?: PoseLandmarker;
  private stream?: MediaStream;
  private timer?: number;
  private busy = false;
  private stopped = false;
  private abort = new AbortController();
  private stage: CameraStage = "permission";
  private startedAt = 0;
  private frames = 0;
  private lastVideoTime = -1;
  private lastVideoAt = 0;
  private lastResultAt = 0;
  private pendingFrameAt = 0;
  private options: CameraOptions = { ...defaultCameraOptions };
  constructor(
    private video: HTMLVideoElement,
    private onPoses: (poses: Pose[]) => void,
    private onError: (error: CameraFailure) => void,
    private diagnostics = new CameraDiagnostics(),
  ) {}

  async start(options: CameraOptions = defaultCameraOptions) {
    this.options = { ...options };
    if (this.stopped) return;
    this.diagnostics.begin(options);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access is unavailable. Open Blob Club over HTTPS in Safari.",
        );
      }
      const acquisition = navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: options.facingMode },
          width: { ideal: options.lowResolution ? 640 : 960 },
          height: { ideal: options.lowResolution ? 480 : 540 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      // A browser permission prompt cannot be cancelled by JavaScript. Release
      // a late grant if the player cancelled or the request timed out.
      void acquisition.then(
        (stream) => {
          if (this.stopped) stream.getTracks().forEach((track) => track.stop());
        },
        () => {},
      );
      this.stream = await this.bounded(
        acquisition,
        45000,
        "Camera permission is still pending. Cancel, check Safari camera permission, and retry.",
      );
      const track = this.stream.getVideoTracks()[0];
      const settings = track.getSettings();
      this.diagnostics.update({
        width: settings.width ?? 0,
        height: settings.height ?? 0,
        frameRate: settings.frameRate ?? 0,
        facingMode: settings.facingMode ?? "unspecified",
      });
      this.diagnostics.record({
        stage: "permission",
        state: "passed",
        message: "Camera access granted.",
      });
      track.addEventListener("ended", () => {
        this.stage = "video";
        this.fail(new Error("The camera track ended. Reconnect the camera."));
      });
      track.addEventListener(
        "mute",
        () =>
          !this.stopped &&
          this.diagnostics.record({
            stage: "video",
            state: "working",
            message: "The camera track is temporarily muted by the browser.",
          }),
      );
      track.addEventListener(
        "unmute",
        () =>
          !this.stopped &&
          this.diagnostics.record({
            stage: "video",
            state: "passed",
            message: "The camera track resumed.",
          }),
      );
      this.stage = "video";
      this.diagnostics.record({
        stage: "video",
        state: "working",
        message: "Starting inline video and waiting for a camera frame.",
      });
      this.video.muted = true;
      this.video.defaultMuted = true;
      this.video.autoplay = true;
      this.video.playsInline = true;
      this.video.srcObject = this.stream;
      await this.bounded(
        this.video.play(),
        12000,
        "Video playback did not start within 12 seconds.",
      );
      await this.waitForVideo();
      this.diagnostics.record({
        stage: "video",
        state: "passed",
        message: `Live video started at ${this.video.videoWidth} × ${this.video.videoHeight}.`,
      });
      this.lastVideoAt = performance.now();
      if (!options.cameraOnly) {
        this.stage = "engine";
        this.diagnostics.record({
          stage: "engine",
          state: "working",
          message: `Loading the motion model in ${options.engine === "compatible" ? "compatibility mode" : "a background worker"}.`,
        });
        if (options.engine === "compatible") await this.startCompatibleEngine();
        else await this.startWorker();
        this.diagnostics.record({
          stage: "engine",
          state: "passed",
          message: "Motion model loaded.",
        });
        this.stage = "tracking";
        this.diagnostics.record({
          stage: "tracking",
          state: "working",
          message: "Waiting for the first tracking result.",
        });
      }
      if (this.stopped) return;
      this.startedAt = performance.now();
      this.lastResultAt = this.startedAt;
      this.timer = window.setInterval(
        () => void this.frame(),
        options.engine === "compatible" ? 150 : 100,
      );
    } catch (error) {
      if (this.stopped) return;
      const failure = this.failure(error);
      this.stop();
      throw failure;
    }
  }

  private bounded<T>(
    promise: Promise<T>,
    ms: number,
    message: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const signal = this.abort.signal;
      const cancel = () => {
        cleanup();
        reject(new DOMException("Camera attempt cancelled.", "AbortError"));
      };
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new DOMException(message, "TimeoutError"));
      }, ms);
      const cleanup = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", cancel);
      };
      if (signal.aborted) {
        cancel();
        return;
      }
      signal.addEventListener("abort", cancel, { once: true });
      promise.then(
        (value) => {
          cleanup();
          resolve(value);
        },
        (error) => {
          cleanup();
          reject(error);
        },
      );
    });
  }

  private async waitForVideo() {
    const started = performance.now();
    while (this.video.readyState < 2 || !this.video.videoWidth) {
      if (this.stopped) throw new DOMException("Cancelled", "AbortError");
      if (performance.now() - started > 12000)
        throw new DOMException(
          "The camera opened, but no video frames arrived.",
          "TimeoutError",
        );
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
  }

  private async startCompatibleEngine() {
    const creation = (async () => {
      const { FilesetResolver, PoseLandmarker } =
        await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(
        `${import.meta.env.BASE_URL}wasm`,
      );
      return PoseLandmarker.createFromOptions(files, {
        canvas: document.createElement("canvas"),
        baseOptions: {
          modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 4,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
      });
    })();
    void creation.then(
      (detector) => {
        if (this.stopped) detector.close();
      },
      () => {},
    );
    this.detector = await this.bounded(
      creation,
      60000,
      "The motion model did not finish loading within 60 seconds.",
    );
  }

  private async startWorker() {
    if (
      typeof Worker === "undefined" ||
      typeof createImageBitmap === "undefined"
    ) {
      throw new Error(
        "This browser lacks the worker or frame-transfer API. Try compatibility mode.",
      );
    }
    this.worker = new Worker(new URL("./pose.worker.ts", import.meta.url), {
      type: "module",
    });
    const ready = new Promise<void>((resolve, reject) => {
      this.worker!.onerror = (event) => {
        const error = new Error(
          event.message || "The background worker could not run.",
        );
        if (this.stage === "engine") reject(error);
        else this.fail(error);
      };
      this.worker!.onmessageerror = () =>
        this.fail(
          new Error(
            "A tracking message could not be transferred from the worker.",
          ),
        );
      this.worker!.onmessage = ({ data }) => {
        if (data.type === "ready") resolve();
        if (data.type === "progress")
          this.diagnostics.record({
            stage: "engine",
            state: "working",
            message: data.message,
          });
        if (data.type === "error") {
          const error = new Error(data.message);
          error.name = data.name || "TrackingError";
          if (this.stage === "engine") reject(error);
          else this.fail(error);
        }
        if (data.type === "poses") {
          this.busy = false;
          this.results(data.poses, data.durationMs);
        }
      };
      this.worker!.postMessage({
        type: "init",
        base: new URL(import.meta.env.BASE_URL, location.origin).href,
      });
    });
    await this.bounded(
      ready,
      60000,
      "The motion worker did not finish loading within 60 seconds.",
    );
  }

  private results(poses: Pose[], durationMs: number) {
    if (this.stopped) return;
    this.frames++;
    this.lastResultAt = performance.now();
    if (this.frames === 1)
      this.diagnostics.record({
        stage: "tracking",
        state: "passed",
        message: "Motion tracking is returning results.",
      });
    this.diagnostics.update({
      processedFrames: this.frames,
      detectedPeople: poses.length,
      inferenceMs: Math.round(durationMs),
      trackingFps:
        Math.round(
          (this.frames /
            Math.max(0.1, (performance.now() - this.startedAt) / 1000)) *
            10,
        ) / 10,
    });
    this.onPoses(poses);
  }

  private async frame() {
    if (this.stopped || document.hidden) {
      this.lastVideoAt = performance.now();
      this.pendingFrameAt = performance.now();
      return;
    }
    const now = performance.now();
    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      this.lastVideoAt = now;
    }
    const track = this.stream?.getVideoTracks()[0];
    this.diagnostics.update({
      videoReadyState: this.video.readyState,
      videoPaused: this.video.paused,
      videoTime: Math.round(this.video.currentTime * 10) / 10,
      videoWidth: this.video.videoWidth,
      videoHeight: this.video.videoHeight,
      trackState: track?.readyState ?? "missing",
      trackMuted: track?.muted ?? false,
      lastVideoFrameAgeMs: Math.round(now - this.lastVideoAt),
      lastTrackingResultAgeMs: this.options.cameraOnly
        ? 0
        : Math.round(now - this.lastResultAt),
    });
    if (now - this.lastVideoAt > 12000) {
      this.stage = "video";
      this.fail(
        new Error("The camera video has stopped advancing for 12 seconds."),
      );
      return;
    }
    if (this.options.cameraOnly) return;
    if (this.busy) {
      if (now - this.pendingFrameAt > 20000)
        this.fail(
          new Error(
            "No tracking result arrived for 20 seconds. Try compatibility mode.",
          ),
        );
      return;
    }
    if (this.video.readyState < 2) return;
    this.busy = true;
    this.pendingFrameAt = now;
    try {
      if (this.detector) {
        const result = this.detector.detectForVideo(this.video, now);
        this.busy = false;
        this.results(result.landmarks, performance.now() - now);
      } else {
        const frame = await createImageBitmap(this.video);
        if (this.stopped) {
          frame.close();
          return;
        }
        try {
          this.worker!.postMessage({ type: "frame", frame, time: now }, [
            frame,
          ]);
        } catch (error) {
          frame.close();
          throw error;
        }
      }
    } catch (error) {
      this.fail(error);
    }
  }

  private failure(error: unknown): CameraFailure {
    const failure = new CameraFailure(this.stage, error);
    this.diagnostics.record({
      stage: failure.stage,
      state: "failed",
      message: failure.message,
      errorName: failure.name,
    });
    return failure;
  }
  private fail(error: unknown) {
    if (this.stopped) return;
    const failure = this.failure(error);
    this.stop();
    this.onError(failure);
  }
  stop() {
    this.stopped = true;
    this.abort.abort();
    clearInterval(this.timer);
    this.worker?.terminate();
    this.detector?.close();
    this.detector = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.video.pause();
    this.video.srcObject = null;
    this.diagnostics.update({ cameraStopped: true });
  }
}
