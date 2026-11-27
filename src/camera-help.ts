import {
  CameraDiagnostics,
  CameraFailure,
  cameraAdvice,
  defaultCameraOptions,
  type CameraOptions,
  type CameraStage,
} from "./camera-diagnostics";
import { Tracker } from "./tracker";

const labels: Record<CameraStage, string> = {
  permission: "Camera access",
  video: "Live video",
  engine: "Motion model",
  tracking: "Joint tracking",
};
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

export class CameraHelp {
  private testTracker?: Tracker;
  private registration?: ServiceWorkerRegistration;
  private lastRender = 0;
  private options: CameraOptions = { ...defaultCameraOptions };
  constructor(
    private diagnostics: CameraDiagnostics,
    private actions: { pause: () => void; stop: () => void; retry: () => void },
  ) {
    try {
      const saved = JSON.parse(
        localStorage.getItem("blob-camera-options") || "null",
      );
      if (saved)
        this.options = {
          engine: saved.engine === "compatible" ? "compatible" : "worker",
          facingMode:
            saved.facingMode === "environment" ? "environment" : "user",
          lowResolution: saved.lowResolution === true,
        };
    } catch {
      /* Defaults are usable when storage is unavailable. */
    }
    const dialog = document.createElement("dialog");
    dialog.id = "camera-help";
    dialog.innerHTML = `<button class="dialog-close" id="close-camera-help" aria-label="Close camera help">×</button>
      <p class="eyebrow">LET’S FIND THE HOLDUP</p><h2>Camera help</h2>
      <p>Test the camera, then try joint tracking. These checks work inside the iPad Home Screen app.</p>
      <div id="camera-help-summary" class="diagnostic-summary" role="status" aria-live="polite">Choose a test to get started.</div>
      <ol class="diagnostic-steps">${Object.entries(labels)
        .map(
          ([stage, label]) =>
            `<li><strong>${label}</strong><span id="diagnostic-${stage}">Waiting</span></li>`,
        )
        .join("")}</ol>
      <div class="diagnostic-video" id="diagnostic-preview" hidden><video id="diagnostic-video" autoplay muted playsinline aria-label="Camera test preview"></video><span>Live camera test</span></div>
      <div class="diagnostic-options"><label>Camera<select id="diagnostic-facing"><option value="user">Front camera</option><option value="environment">Rear camera</option></select></label><label>Tracking mode<select id="diagnostic-engine"><option value="worker">Background worker</option><option value="compatible">Compatibility mode</option></select></label><label class="diagnostic-checkbox"><input type="checkbox" id="diagnostic-low"> Lower camera resolution</label></div>
      <p class="diagnostic-caption">Compatibility mode uses a different tracking path and may run more slowly. These settings apply to your next camera attempt.</p>
      <div class="diagnostic-buttons"><button id="test-camera" class="primary-button">Test camera only</button><button id="retry-tracking" class="diagnostic-button">Try joint tracking</button><button id="stop-test" class="diagnostic-button">Stop camera</button></div>
      <p class="diagnostic-caption">The camera-only test should show a moving picture. If that works, try joint tracking. Stand back until everyone’s feet are visible.</p>
      <dl id="camera-metrics" class="diagnostic-metrics"></dl>
      <details><summary>iPad troubleshooting</summary><ul><li>If camera access is blocked, open Blob Club in Safari and check this website’s camera permission. Check Screen Time restrictions if camera access is restricted.</li><li>Close other apps using the camera. Keep Blob Club visible while testing.</li><li>If the picture works but joint tracking fails, choose Compatibility mode and try again. Lower resolution can help on slower devices.</li><li>Compare the same test in Safari and the Home Screen app. Include the result when sharing the report.</li></ul><a href="${import.meta.env.BASE_URL}" target="_blank" rel="noopener">Open the game in a browser tab</a></details>
      <div class="diagnostic-buttons"><button id="check-camera-files" class="diagnostic-button">Check camera downloads</button><button id="check-app-update" class="diagnostic-button">Check for app updates</button><button id="apply-app-update" class="diagnostic-button" hidden>Reload with update</button><button id="copy-camera-report" class="diagnostic-button">Copy troubleshooting report</button></div>
      <p id="diagnostic-tool-status" role="status" aria-live="polite"></p>
      <details id="camera-report-details"><summary>View troubleshooting report</summary><label for="camera-report">Device details, camera status, and error history</label><textarea id="camera-report" readonly spellcheck="false" rows="12"></textarea></details>
      <p class="diagnostic-caption">The report contains technical status and error messages. Camera images and joint coordinates stay out of the report. Copy it here when you want help.</p><p class="diagnostic-caption" id="camera-build"></p>`;
    document.body.append(dialog);
    $<HTMLSelectElement>("diagnostic-facing").value = this.options.facingMode;
    $<HTMLSelectElement>("diagnostic-engine").value = this.options.engine;
    $<HTMLInputElement>("diagnostic-low").checked = this.options.lowResolution;
    for (const id of [
      "diagnostic-facing",
      "diagnostic-engine",
      "diagnostic-low",
    ])
      $(id).onchange = () => this.saveOptions();
    $("close-camera-help").onclick = () => dialog.close();
    dialog.addEventListener("close", () => this.stopTest());
    $("test-camera").onclick = () => void this.testCamera();
    $("stop-test").onclick = () => {
      this.stopTest();
      this.actions.stop();
      this.summary("Camera stopped. Choose a test when you’re ready.");
    };
    $("retry-tracking").onclick = () => {
      this.saveOptions();
      this.stopTest();
      dialog.close();
      this.actions.retry();
    };
    $("check-camera-files").onclick = () => void this.checkFiles();
    $("check-app-update").onclick = () => void this.checkUpdate();
    $("apply-app-update").onclick = () => {
      if (!this.registration?.waiting) return;
      this.stopTest();
      this.actions.stop();
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => location.reload(),
        { once: true },
      );
      this.registration.waiting.postMessage("activate");
    };
    $("copy-camera-report").onclick = () => void this.copyReport();
    $("camera-report-details").addEventListener("toggle", () => {
      if ($<HTMLDetailsElement>("camera-report-details").open)
        this.refreshReport();
    });
    $("camera-build").textContent =
      `App build ${__APP_BUILD__} · ${matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone ? "Home Screen app" : "browser tab"}`;
    diagnostics.onChange = () => {
      if (dialog.open && performance.now() - this.lastRender > 250)
        this.render();
    };
    window.addEventListener("pagehide", () => this.stopTest());
  }
  get settings() {
    return { ...this.options };
  }
  private saveOptions() {
    this.options = {
      engine: $<HTMLSelectElement>("diagnostic-engine")
        .value as CameraOptions["engine"],
      facingMode: $<HTMLSelectElement>("diagnostic-facing")
        .value as CameraOptions["facingMode"],
      lowResolution: $<HTMLInputElement>("diagnostic-low").checked,
    };
    try {
      localStorage.setItem("blob-camera-options", JSON.stringify(this.options));
    } catch {
      /* Settings still work for this session. */
    }
  }
  open() {
    this.actions.pause();
    this.render();
    if (!$<HTMLDialogElement>("camera-help").open)
      $<HTMLDialogElement>("camera-help").showModal();
    this.refreshReport();
  }
  showFailure(error: CameraFailure) {
    this.summary(cameraAdvice(error.stage, error.name));
    this.render();
  }
  private summary(message: string) {
    $("camera-help-summary").textContent = message;
  }
  private render() {
    this.lastRender = performance.now();
    for (const stage of Object.keys(labels) as CameraStage[]) {
      const event = this.diagnostics.steps.get(stage);
      const element = $(`diagnostic-${stage}`);
      element.textContent = event
        ? `${event.state === "failed" ? (event.errorName || "Failed") + " · " : ""}${event.message}`
        : this.diagnostics.options.cameraOnly &&
            (stage === "engine" || stage === "tracking")
          ? "Skipped during camera-only test"
          : "Waiting";
      element.dataset.state = event?.state ?? "waiting";
    }
    const failure = this.diagnostics.failure;
    const metrics = this.diagnostics.metrics;
    if (failure) this.summary(cameraAdvice(failure.stage, failure.errorName));
    else if (metrics.cameraStopped)
      this.summary("Camera stopped. Choose a test when you’re ready.");
    else if (this.diagnostics.steps.get("tracking")?.state === "passed")
      this.summary(
        "Joint tracking is returning results. Check the people counts below if calibration is waiting.",
      );
    else if (
      this.diagnostics.options.cameraOnly &&
      this.diagnostics.steps.get("video")?.state === "passed"
    )
      this.summary(
        "Camera video is playing. Watch for movement, then choose Try joint tracking.",
      );
    else if (this.diagnostics.steps.size)
      this.summary(
        "Camera setup is in progress. The steps below show where it has reached.",
      );
    const rows = [
      [
        "Video size",
        `${metrics.videoWidth ?? metrics.width ?? 0} × ${metrics.videoHeight ?? metrics.height ?? 0}`,
      ],
      [
        "Video playback",
        metrics.cameraStopped
          ? "Stopped"
          : metrics.videoPaused === false
            ? "Playing"
            : "Waiting",
      ],
      ["Video time", `${metrics.videoTime ?? 0} seconds`],
      ["Tracking speed", `${metrics.trackingFps ?? 0} results/sec`],
      ["People detected", String(metrics.detectedPeople ?? 0)],
      [
        "Whole bodies visible",
        `${metrics.visiblePeople ?? 0} / ${metrics.expectedPeople ?? 0}`,
      ],
    ];
    const list = $("camera-metrics");
    list.replaceChildren();
    for (const [label, value] of rows) {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      list.append(dt, dd);
    }
  }
  private stopTest() {
    this.testTracker?.stop();
    this.testTracker = undefined;
    $("diagnostic-preview").hidden = true;
    $<HTMLButtonElement>("test-camera").disabled = false;
  }
  private async testCamera() {
    this.saveOptions();
    this.stopTest();
    this.actions.stop();
    $("diagnostic-preview").hidden = false;
    $("diagnostic-preview").scrollIntoView({ block: "nearest" });
    $<HTMLButtonElement>("test-camera").disabled = true;
    this.summary(
      "Allow camera access if prompted. Watch for a moving picture below.",
    );
    const tracker = new Tracker(
      $("diagnostic-video"),
      () => {},
      (error) => {
        if (this.testTracker === tracker) {
          this.stopTest();
          this.showFailure(error);
        }
      },
      this.diagnostics,
    );
    this.testTracker = tracker;
    try {
      await tracker.start({ ...this.options, cameraOnly: true });
      if (this.testTracker !== tracker) return;
      this.summary(
        "Camera video is playing. If the picture moves, choose Try joint tracking to test the motion model.",
      );
    } catch (error) {
      if (this.testTracker === tracker) {
        this.stopTest();
        this.showFailure(error as CameraFailure);
      }
    }
    this.render();
  }
  private environment() {
    const nav = navigator as Navigator & { standalone?: boolean };
    return {
      build: __APP_BUILD__,
      userAgent: nav.userAgent,
      platform: nav.platform,
      maxTouchPoints: nav.maxTouchPoints,
      standalone:
        matchMedia("(display-mode: standalone)").matches ||
        nav.standalone === true,
      secureContext: isSecureContext,
      online: nav.onLine,
      visibility: document.visibilityState,
      viewport: { width: innerWidth, height: innerHeight },
      capabilities: {
        getUserMedia: typeof nav.mediaDevices?.getUserMedia === "function",
        worker: typeof Worker !== "undefined",
        webAssembly: typeof WebAssembly !== "undefined",
        createImageBitmap: typeof createImageBitmap === "function",
        offscreenCanvas: typeof OffscreenCanvas !== "undefined",
        webGL2: typeof WebGL2RenderingContext !== "undefined",
      },
      serviceWorker: {
        supported: "serviceWorker" in nav,
        controlled: !!nav.serviceWorker?.controller,
        state: nav.serviceWorker?.controller?.state ?? "none",
        updateWaiting: !!this.registration?.waiting,
      },
    };
  }
  private refreshReport() {
    $<HTMLTextAreaElement>("camera-report").value = this.diagnostics.report(
      this.environment(),
    );
  }
  private async copyReport() {
    this.refreshReport();
    try {
      await navigator.clipboard.writeText(
        $<HTMLTextAreaElement>("camera-report").value,
      );
      $("diagnostic-tool-status").textContent =
        "Report copied. Paste it into this chat so we can inspect the failure.";
    } catch {
      $<HTMLDetailsElement>("camera-report-details").open = true;
      const report = $<HTMLTextAreaElement>("camera-report");
      report.focus();
      report.select();
      $("diagnostic-tool-status").textContent =
        "Automatic copying is unavailable. Touch and hold the selected report, then choose Copy.";
    }
  }
  private async checkFiles() {
    const button = $<HTMLButtonElement>("check-camera-files");
    button.disabled = true;
    const paths = [
      "models/pose_landmarker_lite.task",
      "wasm/vision_wasm_internal.js",
      "wasm/vision_wasm_internal.wasm",
      "wasm/vision_wasm_module_internal.js",
      "wasm/vision_wasm_module_internal.wasm",
    ];
    let failures = 0;
    for (const path of paths) {
      $("diagnostic-tool-status").textContent =
        `Checking ${path.split("/").pop()}…`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length < 1000)
          throw new Error("Download was unexpectedly small.");
        if (
          path.endsWith(".wasm") &&
          !(
            bytes[0] === 0 &&
            bytes[1] === 97 &&
            bytes[2] === 115 &&
            bytes[3] === 109
          )
        )
          throw new Error("Download is not a WebAssembly file.");
        if (
          path.endsWith(".task") &&
          !(
            (bytes[0] === 0 &&
              bytes[1] === 0 &&
              bytes[2] === 80 &&
              bytes[3] === 75) ||
            (bytes[0] === 80 && bytes[1] === 75)
          )
        )
          throw new Error("Download is not a pose model archive.");
        if (
          new TextDecoder()
            .decode(bytes.slice(0, 100))
            .trimStart()
            .startsWith("<")
        )
          throw new Error("The server returned HTML instead of a camera file.");
        this.diagnostics.events.push({
          stage: "engine",
          state: "passed",
          message: `Asset ${path} available (${bytes.length} bytes).`,
          time: new Date().toISOString(),
        });
      } catch (error) {
        failures++;
        this.diagnostics.events.push({
          stage: "engine",
          state: "failed",
          message: `Asset ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
          time: new Date().toISOString(),
        });
      } finally {
        clearTimeout(timeout);
      }
    }
    this.diagnostics.events = this.diagnostics.events.slice(-80);
    $("diagnostic-tool-status").textContent = failures
      ? `${failures} camera download checks failed. Connect to the internet and try again. Details are in the report.`
      : "All camera downloads are available. Try joint tracking next.";
    this.refreshReport();
    button.disabled = false;
  }
  private async checkUpdate() {
    const button = $<HTMLButtonElement>("check-app-update");
    button.disabled = true;
    $("diagnostic-tool-status").textContent = "Checking for an app update…";
    try {
      if (!("serviceWorker" in navigator))
        throw new Error(
          "This browser has no service worker support. Reload this page to get the latest app.",
        );
      this.registration = await navigator.serviceWorker.getRegistration(
        import.meta.env.BASE_URL,
      );
      if (!this.registration)
        throw new Error(
          "Offline installation is still starting. Reload while online, then check again.",
        );
      const renderUpdate = () => {
        $("apply-app-update").hidden = !this.registration?.waiting;
        $("diagnostic-tool-status").textContent = this.registration?.waiting
          ? "An update is ready. Reload with update to use it."
          : this.registration?.installing
            ? "An update is downloading. Keep the app open."
            : "This installed app is up to date.";
      };
      this.registration.addEventListener(
        "updatefound",
        () => {
          this.registration?.installing?.addEventListener(
            "statechange",
            renderUpdate,
          );
          renderUpdate();
        },
        { once: true },
      );
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          this.registration.update(),
          new Promise((_, reject) => {
            timeout = setTimeout(
              () =>
                reject(
                  new Error(
                    "The update check is taking longer than expected. Keep the app open and check again while online.",
                  ),
                ),
              20000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      renderUpdate();
    } catch (error) {
      $("diagnostic-tool-status").textContent =
        error instanceof Error
          ? error.message
          : "Update check failed. Connect to the internet and try again.";
    } finally {
      button.disabled = false;
    }
  }
}
