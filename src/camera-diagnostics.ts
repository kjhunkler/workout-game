export type CameraStage = "permission" | "video" | "engine" | "tracking";
export type CameraState = "waiting" | "working" | "passed" | "failed";
export type CameraEvent = {
  stage: CameraStage;
  state: CameraState;
  message: string;
  errorName?: string;
};
export type CameraOptions = {
  engine: "worker" | "compatible";
  facingMode: "user" | "environment";
  lowResolution: boolean;
  cameraOnly?: boolean;
};
export const defaultCameraOptions: CameraOptions = {
  engine: "worker",
  facingMode: "user",
  lowResolution: false,
};
export class CameraFailure extends Error {
  constructor(
    public stage: CameraStage,
    error: unknown,
  ) {
    super(error instanceof Error ? error.message : String(error));
    this.name = error instanceof Error ? error.name : "CameraError";
  }
}
export function cameraAdvice(stage: CameraStage, name = ""): string {
  if (stage === "permission") {
    if (name === "NotAllowedError" || name === "SecurityError")
      return "Camera access was blocked. Open this site in Safari and check its website camera permission. Check iPad Screen Time restrictions if camera access is restricted, then retry.";
    if (name === "NotFoundError")
      return "No camera was available. Try the other camera and check that Camera works on this iPad.";
    if (name === "NotReadableError")
      return "The camera could not open. Close other apps using it, fully close Blob Club, and reopen it.";
    return "Respond to the camera prompt. If it never appears, cancel this attempt and try the site in Safari. Compare the result with the Home Screen app.";
  }
  if (stage === "video")
    return "The camera opened, but video did not start. Retry with the preview visible. Try the other camera or lower resolution, and compare with Safari.";
  if (stage === "engine")
    return "Try compatibility mode, then check the camera downloads. Keep this app in the foreground while the motion model loads.";
  return "Try compatibility mode and lower resolution. Keep everyone’s whole body in view and leave the app in the foreground.";
}
export class CameraDiagnostics {
  steps = new Map<CameraStage, CameraEvent>();
  events: (CameraEvent & { time: string })[] = [];
  metrics: Record<string, string | number | boolean> = {};
  options: CameraOptions = { ...defaultCameraOptions };
  onChange?: () => void;
  begin(options: CameraOptions) {
    this.options = { ...options };
    this.steps.clear();
    this.metrics = {};
    this.record({
      stage: "permission",
      state: "working",
      message: options.cameraOnly
        ? "Starting a camera-only test."
        : `Starting camera with ${options.engine} tracking.`,
    });
  }
  record(event: CameraEvent) {
    event = { ...event, message: event.message.slice(0, 1000) };
    this.steps.set(event.stage, event);
    this.events.push({
      ...event,
      message: event.message.slice(0, 1000),
      time: new Date().toISOString(),
    });
    this.events = this.events.slice(-80);
    this.onChange?.();
  }
  update(metrics: Record<string, string | number | boolean>) {
    Object.assign(this.metrics, metrics);
    this.onChange?.();
  }
  get failure() {
    return [...this.steps.values()].find((step) => step.state === "failed");
  }
  report(environment: Record<string, unknown>): string {
    return JSON.stringify(
      {
        app: "Blob Club",
        capturedAt: new Date().toISOString(),
        environment,
        options: this.options,
        steps: [...this.steps.values()],
        metrics: this.metrics,
        events: this.events,
      },
      null,
      2,
    );
  }
}
