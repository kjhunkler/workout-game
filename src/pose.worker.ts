/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
let detector: PoseLandmarker | undefined;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      const files = await FilesetResolver.forVisionTasks(`${data.base}wasm`);
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${data.base}models/pose_landmarker_lite.task`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 4,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
      });
      self.postMessage({ type: "ready" });
    } else if (data.type === "frame") {
      try {
        const result = detector?.detectForVideo(data.frame, data.time);
        self.postMessage({ type: "poses", poses: result?.landmarks ?? [] });
      } finally {
        data.frame.close();
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Tracking could not start.",
    });
  }
};
