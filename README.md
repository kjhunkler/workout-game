# Blob Club

An installable, shared-camera playground for Avery, Cameron, and friends. Avery starts blue and Cameron green. Up to four people choose their own blob colors and play together on one device.

## Trail Dash

A 60-second run with logs to jump, arches to duck under, and rocks to dodge. The trail advances automatically. Every obstacle cleared earns 100 points, and every player finishes the round.

Connect a camera and stand side by side, with your feet visible. Players are assigned from left to right in the mirrored preview. Stand tall for calibration, then start the round. Stay in that order and leave room to move. Missing players pause the game. Recalibrate when the camera or player positions change.

Keyboard controls are W/A/S/D for Avery, arrow keys for Cameron, I/J/K/L for Player 3, and T/F/G/H for Player 4. Up jumps, down ducks, and left/right dodges. Touch controls let you select the player they operate.

## Development

Requires Node.js 22 or newer.

```sh
npm ci
node scripts/prepare-assets.mjs
npm run dev
```

Open the printed URL at `/workout-game/`. Camera access requires HTTPS or localhost.

```sh
npm run check
npm test
npm run build
```

The build copies MediaPipe's WASM runtime and creates a versioned service worker. The app, fonts, runtime, and pose model are cached together. Wait for “Ready for offline play” on the production app before disconnecting. Installation uses the browser install menu or Safari's Share → Add to Home Screen. App updates are offered for reload so a round can finish first.

## Structure

- `src/tracker.ts` and `src/pose.worker.ts` acquire video and run MediaPipe Pose Landmarker locally in a worker, with up to four poses.
- `src/motion.ts` handles player matching, personal calibration measurements, and gesture interpretation.
- `src/types.ts` holds the game registry and shared motion types.
- `src/game.ts` runs Trail Dash timing, obstacles, and independent player scores.
- `src/renderer.ts` draws the original blob characters and trail.

To add another motion game, add its definition to the registry and implement its rules against the shared `Motion` input. The camera layer is independent of Trail Dash.

Video is never recorded or uploaded. Color choices and crew best scores are saved in browser storage. Lighting, clothing, occlusion, camera angle, and device speed affect pose detection. Player matching uses positions and can confuse people who cross over each other. Use the preview to check assignment and recalibrate after swapping places. Live multi-person camera behavior needs testing on the intended device.

## Deployment

Push completed changes directly to `main`, following `AGENTS.md`. `.github/workflows/pages.yml` runs tests, builds the PWA, uploads a Pages artifact, and deploys with GitHub Actions. The repository's Settings → Pages source must be set to **GitHub Actions**. The target URL is https://kjhunkler.github.io/workout-game/.

## Model and runtime

The bundled `public/models/pose_landmarker_lite.task` is Google's MediaPipe Pose Landmarker Lite model, float16 version 1, downloaded from https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task. MediaPipe Tasks Vision and the model are provided under Apache-2.0. The dependency includes its license. See https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker for model documentation. Fonts are Outfit and DM Sans, distributed by Fontsource with their SIL Open Font Licenses.
