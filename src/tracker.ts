import type { Pose } from "./types";
export class Tracker {
  private worker?: Worker;
  private stream?: MediaStream;
  private timer?: number;
  private busy = false;
  private stopped = false;
  private generation = 0;
  private cancelStart?: () => void;
  constructor(
    private video: HTMLVideoElement,
    private onPoses: (poses: Pose[]) => void,
    private onError: (message: string) => void,
  ) {}
  async start() {
    const generation = ++this.generation;
    this.stopped = false;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Camera access needs HTTPS and a supported browser. You can use buttons to play.",
      );
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 960 },
        height: { ideal: 540 },
      },
      audio: false,
    });
    if (this.stopped || generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    this.stream
      .getVideoTracks()[0]
      .addEventListener("ended", () =>
        this.onError("The camera disconnected. Reconnect it to continue."),
      );
    this.video.srcObject = this.stream;
    await this.video.play();
    if (this.stopped) return;
    this.worker = new Worker(new URL("./pose.worker.ts", import.meta.url), {
      type: "module",
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () =>
          reject(
            new Error(
              "Tracking took too long to load. Check your connection and try again.",
            ),
          ),
        60000,
      );
      this.cancelStart = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.worker!.onerror = () => {
        clearTimeout(timeout);
        reject(
          new Error(
            "This browser could not load motion tracking. Try Chrome or Safari, or play with buttons.",
          ),
        );
        this.onError(
          "Motion tracking stopped. Try the camera again or use buttons.",
        );
      };
      this.worker!.onmessage = ({ data }) => {
        if (data.type === "ready") {
          clearTimeout(timeout);
          resolve();
        }
        if (data.type === "error") {
          clearTimeout(timeout);
          reject(new Error(data.message));
          this.onError(
            "Motion tracking stopped. Try the camera again or use buttons.",
          );
        }
        if (data.type === "poses") {
          this.busy = false;
          this.onPoses(data.poses);
        }
      };
      this.worker!.postMessage({
        type: "init",
        base: new URL(import.meta.env.BASE_URL, location.origin).href,
      });
    });
    if (!this.stopped)
      this.timer = window.setInterval(() => void this.frame(), 90);
  }
  private async frame() {
    if (
      this.busy ||
      this.stopped ||
      this.video.readyState < 2 ||
      document.hidden
    )
      return;
    this.busy = true;
    try {
      const frame = await createImageBitmap(this.video);
      if (this.stopped) {
        frame.close();
        return;
      }
      this.worker?.postMessage(
        { type: "frame", frame, time: performance.now() },
        [frame],
      );
    } catch {
      this.busy = false;
      this.onError("The camera feed was interrupted. Try connecting again.");
    }
  }
  stop() {
    this.stopped = true;
    this.generation++;
    this.cancelStart?.();
    this.cancelStart = undefined;
    clearInterval(this.timer);
    this.worker?.terminate();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.video.srcObject = null;
    this.busy = false;
  }
}
