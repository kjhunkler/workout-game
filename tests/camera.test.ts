import { test } from "node:test";
import assert from "node:assert/strict";
import { Tracker } from "../src/tracker";
import {
  CameraDiagnostics,
  CameraFailure,
  cameraAdvice,
  defaultCameraOptions,
} from "../src/camera-diagnostics";

function setup(
  t: Parameters<Parameters<typeof test>[1]>[0],
  getUserMedia?: () => Promise<unknown>,
) {
  let stopped = 0;
  const track = new EventTarget() as EventTarget & {
    stop: () => void;
    getSettings: () => object;
    readyState: string;
    muted: boolean;
  };
  track.stop = () => {
    stopped++;
    track.readyState = "ended";
  };
  track.readyState = "live";
  track.muted = false;
  track.getSettings = () => ({
    width: 640,
    height: 480,
    frameRate: 24,
    facingMode: "user",
    deviceId: "should-not-appear",
  });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const video = {
    readyState: 2,
    videoWidth: 640,
    videoHeight: 480,
    currentTime: 1,
    paused: false,
    srcObject: null,
    muted: false,
    playsInline: false,
    defaultMuted: false,
    autoplay: false,
    play: async () => {},
    pause: () => {
      video.paused = true;
    },
  };
  const previous = [
    "navigator",
    "window",
    "document",
    "Worker",
    "createImageBitmap",
  ].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: { getUserMedia: getUserMedia ?? (async () => stream) },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { hidden: false },
  });
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: undefined,
  });
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const diagnostics = new CameraDiagnostics();
  const errors: CameraFailure[] = [];
  const tracker = new Tracker(
    video as unknown as HTMLVideoElement,
    () => {},
    (error) => errors.push(error),
    diagnostics,
  );
  t.after(() => tracker.stop());
  return {
    tracker,
    diagnostics,
    video,
    stream,
    track,
    errors,
    stopped: () => stopped,
  };
}

test("camera-only test starts inline video, skips the model, and releases its camera", async (t) => {
  const f = setup(t);
  await f.tracker.start({ ...defaultCameraOptions, cameraOnly: true });
  assert.equal(f.diagnostics.steps.get("permission")?.state, "passed");
  assert.equal(f.diagnostics.steps.get("video")?.state, "passed");
  assert.equal(f.diagnostics.steps.has("engine"), false);
  assert.equal(f.video.playsInline, true);
  assert.equal(f.video.muted, true);
  assert.equal(f.video.autoplay, true);
  assert.equal(f.video.srcObject, f.stream);
  assert.ok(!f.diagnostics.report({}).includes("should-not-appear"));
  f.tracker.stop();
  assert.equal(f.video.srcObject, null);
  assert.equal(f.stopped(), 1);
});

test("permission errors keep their original stage, name, and message", async (t) => {
  const f = setup(t, async () => {
    throw new DOMException("Permission denied by Safari.", "NotAllowedError");
  });
  await assert.rejects(
    f.tracker.start(),
    (error) =>
      error instanceof CameraFailure &&
      error.stage === "permission" &&
      error.name === "NotAllowedError" &&
      error.message === "Permission denied by Safari.",
  );
  assert.equal(f.diagnostics.failure?.errorName, "NotAllowedError");
  assert.match(cameraAdvice("permission", "NotAllowedError"), /Safari/);
});

test("stopping during a permission prompt releases a later camera grant", async (t) => {
  let grant!: (stream: unknown) => void;
  const f = setup(
    t,
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const start = f.tracker.start();
  f.tracker.stop();
  await start;
  grant(f.stream);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.stopped(), 1);
  assert.equal(f.video.srcObject, null);
  assert.equal(f.diagnostics.failure, undefined);
});

test("permission prompts time out and a late camera grant is stopped", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let grant!: (stream: unknown) => void;
  const f = setup(
    t,
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const result = assert.rejects(
    f.tracker.start(),
    (error) =>
      error instanceof CameraFailure &&
      error.stage === "permission" &&
      error.name === "TimeoutError",
  );
  t.mock.timers.tick(45001);
  await result;
  grant(f.stream);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.stopped(), 1);
});

test("a hanging video.play reports a video timeout and frees the camera", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = setup(t);
  let playCalled = false;
  f.video.play = () => {
    playCalled = true;
    return new Promise(() => {});
  };
  const result = assert.rejects(
    f.tracker.start(),
    (error) =>
      error instanceof CameraFailure &&
      error.stage === "video" &&
      error.name === "TimeoutError",
  );
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(playCalled, true);
  t.mock.timers.tick(12001);
  await result;
  assert.equal(f.stopped(), 1);
  assert.equal(f.diagnostics.failure?.stage, "video");
});

test("worker capability errors identify model startup and preserve compatibility guidance", async (t) => {
  const f = setup(t);
  await assert.rejects(
    f.tracker.start(),
    (error) =>
      error instanceof CameraFailure &&
      error.stage === "engine" &&
      /compatibility mode/.test(error.message),
  );
  assert.equal(f.diagnostics.steps.get("video")?.state, "passed");
  assert.equal(f.diagnostics.failure?.stage, "engine");
  assert.equal(f.stopped(), 1);
});

test("a disconnected live camera reports a video-stage failure", async (t) => {
  const f = setup(t);
  await f.tracker.start({ ...defaultCameraOptions, cameraOnly: true });
  f.track.dispatchEvent(new Event("ended"));
  assert.equal(f.errors[0].stage, "video");
  assert.equal(f.video.srcObject, null);
});

test("diagnostic history is bounded and retries clear current failures", () => {
  const diagnostics = new CameraDiagnostics();
  for (let i = 0; i < 100; i++)
    diagnostics.record({
      stage: "engine",
      state: "failed",
      message: `failure ${i}`,
    });
  assert.equal(diagnostics.events.length, 80);
  diagnostics.begin(defaultCameraOptions);
  assert.equal(diagnostics.failure, undefined);
  assert.equal(diagnostics.events.length, 80);
  const report = JSON.parse(
    diagnostics.report({ build: "test", standalone: true }),
  );
  assert.equal(report.environment.build, "test");
  assert.equal(report.events.length, 80);
});
