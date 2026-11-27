import { SpaceRide } from "./space";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./style.css";
import {
  GAMES,
  type Player,
  type Motion,
  type Pose,
  type Baseline,
  type Action,
} from "./types";
import { interpret, isVisible, matchPoses, measure } from "./motion";
import { Tracker } from "./tracker";
import {
  CameraDiagnostics,
  CameraFailure,
  cameraAdvice,
} from "./camera-diagnostics";
import { CameraHelp } from "./camera-help";
import { Run } from "./game";
import { Renderer } from "./renderer";

const colors = [
  "#6f9be8",
  "#83b888",
  "#bc8ed1",
  "#eea173",
  "#e47e9b",
  "#dec05d",
];
const defaults: Player[] = [
  { id: "avery", name: "Avery", color: colors[0], active: true },
  { id: "cameron", name: "Cameron", color: colors[1], active: true },
];
function loadPlayers(): Player[] {
  try {
    const saved = JSON.parse(localStorage.getItem("blob-players") || "null");
    if (
      Array.isArray(saved) &&
      saved.length >= 2 &&
      saved.length <= 4 &&
      saved.every(
        (p) => colors.includes(p.color) && typeof p.active === "boolean",
      ) &&
      saved.some((p) => p.active)
    ) {
      return saved.map((p, i) => ({
        id: defaults[i]?.id ?? `friend-${i}`,
        name: defaults[i]?.name ?? `Player ${i + 1}`,
        color: p.color,
        active: p.active,
      }));
    }
  } catch {
    /* Browser storage may be unavailable. */
  }
  return defaults.map((player) => ({ ...player }));
}
let players = loadPlayers();
let mode: "buttons" | "camera" = "buttons";
let phase: "lobby" | "countdown" | "running" | "paused" | "finished" = "lobby";
let run: Run | undefined;
let motions: Motion[] = [];
let tracker: Tracker | undefined;
let calibrating = false,
  calibrated = false,
  cameraLoading = false;
let samples: Baseline[][] = [],
  baselines: Baseline[] = [],
  anchors: Baseline[] = [];
let calibrationStart = 0,
  lastPoseAt = 0,
  countdown = 3;
let lastSeen: number[] = [];
let sound = false;
let audio: AudioContext | undefined;
let touchPlayer = 0;
const pressed = new Set<string>();
const jumpUntil = [0, 0, 0, 0];
const touchPressed = new Set<Action>();
const keys = [
  ["a", "d", "w", "s"],
  ["arrowleft", "arrowright", "arrowup", "arrowdown"],
  ["j", "l", "i", "k"],
  ["f", "h", "t", "g"],
];
const active = () => players.filter((player) => player.active);
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

$("app").innerHTML = `
<header class="topbar"><a class="brand" href="./" aria-label="Blob Club home"><span class="brand-blob"><i></i></span><span>blob club<span class="brand-period">.</span></span></a><nav aria-label="Main"><button class="nav-play selected" id="home">Let’s play</button><button id="how">How to play</button></nav><div class="top-actions"><button id="sound" class="quiet-button" aria-pressed="false">Sound off</button><button id="install" class="install-button">Install app <span aria-hidden="true">＋</span></button></div></header>
<main>
<div class="page-intro"><div><p class="eyebrow">A LITTLE MOVEMENT. A LOT OF PLAY.</p><h1>Your living room.<br class="mobile-break"> Our playground.</h1></div><div class="club-note"><span class="tiny-spark">✳</span> Made for moving<br>together.</div></div>
<div class="playground">
<aside class="setup"><div class="section-title"><h2>The crew</h2><span id="player-count">2 players</span></div><p class="muted">Pick a blob. Make it yours.</p><div id="players"></div><button id="add-player" class="add-player">＋ Add a friend</button><div class="setup-divider"></div><div class="section-title"><h2>Today’s adventure</h2><span class="tiny-spark">✳</span></div><div class="game-choice"><span class="game-art"><i></i><i></i><i></i></span><div><strong>Trail Dash</strong><span>Jump, duck & dodge</span></div><span class="choice-check">✓</span></div><div class="game-meta"><span>60-second rounds</span><span>1–4 players</span></div><div class="camera-status" id="camera-status"><span class="camera-icon"></span><p id="camera-label">Your body is the controller.<small>Connect a camera to get moving.</small></p></div><button id="camera" class="primary-button">Let’s connect the camera <span aria-hidden="true">◉</span></button><button id="manual" class="text-button">Play with buttons</button><button id="camera-help-open" class="text-button">Camera help & diagnostics</button><p class="privacy">Camera video stays on your device.</p></aside>
<section class="game-stage" aria-label="Trail Dash game"><div class="stage-top"><span class="game-tag"><span class="tiny-spark">✳</span> TRAIL DASH</span><div class="stage-tools"><span id="mode-label">MOVE • PLAY • REPEAT</span><button id="pause" hidden aria-label="Pause game">Ⅱ</button><button id="fullscreen" aria-label="Toggle full screen">⛶</button></div></div><canvas id="scene" aria-label="Avery and Cameron’s blobs on a pastel running trail"></canvas><div class="scene-intro" id="scene-intro"><h2>Big moves.<br>Little blobs.</h2><p>A happy little race for your whole body.</p></div><div class="scene-sticker" id="sticker"><span>GOOD TIMES</span><strong>ahead!</strong><span>JUST ADD YOU</span></div><div class="hud" id="hud" hidden><div id="scores"></div><div class="time"><strong id="time">60</strong><span>seconds</span></div></div><div class="cue" id="cue" hidden></div><div class="scene-bottom" id="scene-bottom"><span><i class="status-dot"></i>Ready when you are</span><span>Room for everyone. Space to move.</span></div><div class="overlay" id="overlay" hidden><div class="overlay-card" id="overlay-content"></div></div><div class="camera-preview" id="camera-preview" hidden><video id="video" autoplay muted playsinline></video><canvas id="joints"></canvas><span id="tracking-label">Finding the crew…</span><button id="camera-stop" aria-label="Turn camera off">×</button></div></section>
</div>
<div class="bottom-row"><div class="motion-guide"><span class="guide-label">THREE LITTLE MOVES</span><div><span class="motion-icon jump-icon">↟</span><span><strong>Jump up</strong><small>Over the logs</small></span></div><div><span class="motion-icon duck-icon">⌄</span><span><strong>Duck down</strong><small>Under the arches</small></span></div><div><span class="motion-icon dodge-icon">↔</span><span><strong>Step sideways</strong><small>Around the rocks</small></span></div></div><p class="footer-note">Happy bodies. Happy blobs.<span id="offline-status">A little playground, wherever you are.</span></p></div>
<div class="touch-controls" id="touch-controls" hidden><label>Control <select id="touch-player"></select></label><button data-action="left" aria-label="Move left">←</button><button data-action="jump">Jump</button><button data-action="duck">Duck</button><button data-action="right" aria-label="Move right">→</button></div><p id="notice" role="status" aria-live="polite"></p>
</main>
<dialog id="help"><button class="dialog-close" id="close-help" aria-label="Close instructions">×</button><p class="eyebrow">WELCOME TO THE CLUB</p><h2>Make a little room.<br>Make some big moves.</h2><p>Choose your players and colors, then connect your camera. Stand side by side with your whole body visible and a little space around you.</p><ol><li><strong>Find your spot.</strong> The crew is assigned from left to right in the mirrored camera preview. Stay in that order.</li><li><strong>Stand tall and still.</strong> A short calibration learns each player’s standing position.</li><li><strong>Follow the trail.</strong> Jump over logs, duck under arches, and step away from rocks. Every clear earns 100 points. Everyone plays the whole minute!</li></ol><p class="help-tip">Clear the floor and keep enough space to move without bumping into each other. Run in place if you like. The trail moves automatically.</p><h3>Playing with buttons?</h3><p>Avery uses W A S D. Cameron uses the arrow keys. Player 3 uses I J K L. Player 4 uses T F G H. Up jumps, down ducks, and left or right dodges. On a touch screen, choose a player above the buttons.</p><p>Camera tracking works best in good light with every player’s feet visible. Video is processed on this device.</p></dialog>
<dialog id="install-help"><button class="dialog-close" id="close-install" aria-label="Close install help">×</button><p class="eyebrow">TAKE YOUR BLOBS WITH YOU</p><h2>A playground on your home screen.</h2><p>On iPhone or iPad, open this page in Safari, tap Share, then <strong>Add to Home Screen</strong>.</p><p>On Android or desktop, use your browser’s <strong>Install app</strong> or <strong>Add to Home Screen</strong> menu.</p><p id="install-offline">Keep the app open until “Ready for offline play” appears to save the game and camera model.</p></dialog>`;
let space = true;
const ride = new SpaceRide($("scene"));
document.body.classList.add('immersive');
const spaceTools = document.createElement('div');
spaceTools.className='space-tools';
spaceTools.innerHTML='<button id="space-camera" aria-label="Connect camera">📷</button><button id="space-menu" aria-label="Choose game">☰</button><button id="space-full" aria-label="Fullscreen">⛶</button>';
document.body.append(spaceTools);
$("space-camera").onclick=()=>{phase='lobby';void connectCamera();};
$("space-menu").onclick=()=>{space=!space;document.body.classList.toggle('immersive',space);if(!space)backToLobby();else {$("overlay").hidden=true;hideIntro();}};
$("space-full").onclick=()=>void document.documentElement.requestFullscreen?.().catch(()=>{});
document.addEventListener('pointerdown',()=>{if(space)void document.documentElement.requestFullscreen?.().catch(()=>{});},{once:true});
const scene=$<HTMLCanvasElement>('scene');
scene.addEventListener('pointerdown',e=>{if(space){scene.setPointerCapture(e.pointerId);ride.pointer={x:e.offsetX/scene.clientWidth,y:e.offsetY/scene.clientHeight};}});
scene.addEventListener('pointermove',e=>{if(ride.pointer)ride.pointer={x:e.offsetX/scene.clientWidth,y:e.offsetY/scene.clientHeight};});
for(const event of ['pointerup','pointercancel'])scene.addEventListener(event,()=>ride.pointer=undefined);
window.addEventListener('keydown',e=>{if(space && e.code==='Space'){e.preventDefault();ride.pointer={x:.5,y:.15};}});
window.addEventListener('keyup',e=>{if(e.code==='Space')ride.pointer=undefined;});
const renderer = new Renderer($("scene"));
const cameraDiagnostics = new CameraDiagnostics();
const cameraHelp = new CameraHelp(cameraDiagnostics, {
  pause: () => pause(),
  stop: stopCamera,
  retry: () => {
    stopCamera();
    void connectCamera();
  },
});
$("camera-help-open").onclick = () => cameraHelp.open();
function persist() {
  try {
    localStorage.setItem("blob-players", JSON.stringify(players));
  } catch {
    /* Play still works without storage. */
  }
}
function renderPlayers() {
  $("players").innerHTML = players
    .map(
      (player, index) =>
        `<div class="player-card ${player.active ? "active" : "inactive"}" style="--player-color:${player.color}"><button class="player-toggle" data-player="${index}" aria-pressed="${player.active}" aria-label="${player.active ? "Remove" : "Add"} ${player.name} ${player.active ? "from" : "to"} game"><span class="mini-blob"><i></i></span><span><strong>${player.name}</strong><small>${index === 0 ? "A little bold." : index === 1 ? "A little wild." : "A little more fun."}</small></span><span class="player-check">${player.active ? "✓" : "＋"}</span></button><div class="colors" role="group" aria-label="${player.name}’s color">${colors.map((color, c) => `<button style="--swatch:${color}" class="swatch ${player.color === color ? "chosen" : ""}" data-color="${c}" data-owner="${index}" aria-label="${player.name} ${["blue", "green", "purple", "orange", "pink", "yellow"][c]}" aria-pressed="${player.color === color}"></button>`).join("")}</div></div>`,
    )
    .join("");
  $("player-count").textContent =
    `${active().length} player${active().length === 1 ? "" : "s"}`;
  ($("add-player") as HTMLButtonElement).disabled =
    players.length >= 4 || phase !== "lobby";
  $("touch-player").innerHTML = active()
    .map((p, i) => `<option value="${i}">${p.name}</option>`)
    .join("");
  touchPlayer = 0;
  motions = active().map(() => ({
    action: "run",
    lean: 0,
    tracked: mode === "buttons",
  }));
}
function notice(text: string) {
  $("notice").textContent = text;
}
function cameraLabel(text: string, detail: string) {
  $("camera-label").replaceChildren();
  const small = document.createElement("small");
  small.textContent = detail;
  $("camera-label").append(text, small);
}
function resetCalibration() {
  calibrated = false;
  calibrating = false;
  samples = [];
  baselines = [];
  anchors = [];
}
function showOverlay(content: string) {
  $("overlay").hidden = false;
  $("overlay-content").innerHTML = content;
}
function hideIntro() {
  $("scene-intro").hidden = true;
  $("sticker").hidden = true;
  $("scene-bottom").hidden = true;
}
function playTone() {
  if (!sound) return;
  audio ??= new AudioContext();
  void audio.resume();
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(620, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    900,
    audio.currentTime + 0.1,
  );
  gain.gain.setValueAtTime(0.06, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.2);
}
function startRound() {
  if (mode === "camera" && (!calibrated || motions.some((m) => !m.tracked))) {
    notice("Let’s find every player and calibrate first.");
    return;
  }
  document.body.classList.add("trail-playing");
  run = new Run(GAMES[0], active());
  run.onClear = playTone;
  $("time").textContent = String(run.definition.duration);
  phase = "countdown";
  countdown = 3;
  pressed.clear();
  touchPressed.clear();
  jumpUntil.fill(0);
  hideIntro();
  $("hud").hidden = false;
  $("pause").hidden = false;
  $("cue").hidden = true;
  $("touch-controls").hidden = mode === "camera";
  $("mode-label").textContent =
    mode === "camera" ? "CAMERA PLAY" : "BUTTON PLAY";
  notice(
    mode === "buttons"
      ? "Avery · W A S D     Cameron · arrow keys. Hold down to duck."
      : "Move with your blob. Stay in your own space.",
  );
  showOverlay(
    '<p class="eyebrow">HERE WE GO</p><h2 class="countdown-number">3</h2><p>Find your feet. Feel the beat.</p>',
  );
  renderScores();
}
function renderScores() {
  if (run)
    $("scores").innerHTML = run.players
      .map(
        (p, i) =>
          `<div class="score"><i style="background:${p.color}"></i><span>${p.name}<strong>${run!.scores[i]}</strong></span></div>`,
      )
      .join("");
}
function pause(reason = "Take a breather.") {
  if (phase !== "running" && phase !== "countdown") return;
  phase = "paused";
  pressed.clear();
  touchPressed.clear();
  $("cue").hidden = true;
  showOverlay(
    `<p class="eyebrow">A LITTLE PAUSE</p><h2>${reason}</h2><p id="resume-hint">Your trail will be here.</p><button class="primary-button" id="resume">Keep going</button><button class="text-button" id="back-lobby">Back to the crew</button>`,
  );
  $("resume").onclick = () => {
    if (mode === "camera" && motions.some((m) => !m.tracked)) {
      $("resume-hint").textContent =
        "Bring everyone back into view, then keep going.";
      return;
    }
    phase = "countdown";
    countdown = 3;
  };
  $("back-lobby").onclick = backToLobby;
}
function backToLobby() {
  document.body.classList.remove("trail-playing");
  phase = "lobby";
  run = undefined;
  pressed.clear();
  touchPressed.clear();
  $("overlay").hidden = true;
  $("hud").hidden = true;
  $("cue").hidden = true;
  $("pause").hidden = true;
  $("touch-controls").hidden = true;
  $("scene-intro").hidden = false;
  $("sticker").hidden = false;
  $("scene-bottom").hidden = false;
  renderPlayers();
  if (mode === "camera") {
    resetCalibration();
    calibrating = true;
    cameraLabel(
      "Let’s find your spots.",
      "Stand still with your whole body visible.",
    );
  }
}
function finish() {
  phase = "finished";
  $("cue").hidden = true;
  $("pause").hidden = true;
  const bestKey = `blob-best-${active().length}`;
  let best = 0;
  try {
    best = Number(localStorage.getItem(bestKey) || 0);
    const total = run!.scores.reduce((a, b) => a + b, 0);
    localStorage.setItem(bestKey, String(Math.max(best, total)));
  } catch {
    /* Optional local best. */
  }
  const total = run!.scores.reduce((a, b) => a + b, 0);
  showOverlay(
    `<p class="eyebrow">LOOK AT YOU GO!</p><h2>Little blobs.<br>Big finish.</h2><p>${total > best ? "A new crew best!" : "Another happy lap together."}</p><div class="results">${run!.players.map((p, i) => `<div><i style="background:${p.color}"></i><strong>${p.name}</strong><span>${run!.scores[i]} pts</span></div>`).join("")}</div><button id="again" class="primary-button">One more round</button><button id="back-lobby" class="text-button">Back to the crew</button>`,
  );
  $("again").onclick = startRound;
  $("back-lobby").onclick = backToLobby;
}
function stopCamera() {
  tracker?.stop();
  tracker = undefined;
  mode = "buttons";
  cameraLoading = false;
  resetCalibration();
  $("camera-preview").hidden = true;
  ($("camera") as HTMLButtonElement).disabled = false;
  $("camera").textContent = "Let’s connect the camera";
  cameraLabel(
    "Your body is the controller.",
    "Connect a camera to get moving.",
  );
  backToLobby();
}
function drawJoints(poses: Pose[]) {
  const canvas = $<HTMLCanvasElement>("joints"),
    c = canvas.getContext("2d")!;
  canvas.width = 320;
  canvas.height = 180;
  const links = [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28],
  ];
  poses.forEach((pose, index) => {
    c.strokeStyle = active()[index]?.color ?? "#ffffff";
    c.fillStyle = c.strokeStyle;
    c.lineWidth = 3;
    for (const [a, b] of links) {
      if (
        (pose[a]?.visibility ?? 0) < 0.45 ||
        (pose[b]?.visibility ?? 0) < 0.45
      )
        continue;
      c.beginPath();
      c.moveTo((1 - pose[a].x) * 320, pose[a].y * 180);
      c.lineTo((1 - pose[b].x) * 320, pose[b].y * 180);
      c.stroke();
    }
    for (const point of pose) {
      if ((point.visibility ?? 0) < 0.45) continue;
      c.beginPath();
      c.arc((1 - point.x) * 320, point.y * 180, 2, 0, Math.PI * 2);
      c.fill();
    }
  });
}
function onPoses(poses: Pose[]) {
  lastPoseAt = performance.now();
  if(space){ride.accept(poses);drawJoints(poses);return;}
  const visible = poses
    .filter(isVisible)
    .sort((a, b) => measure(a).x - measure(b).x);
  cameraDiagnostics.update({
    expectedPeople: active().length,
    visiblePeople: visible.length,
  });
  if (calibrating) {
    drawJoints(visible);
    if (visible.length !== active().length) {
      samples = [];
      calibrationStart = 0;
      $("tracking-label").textContent =
        `${visible.length} of ${active().length} players in view`;
      $("calibration-message")?.replaceChildren(
        document.createTextNode("Step back until everyone’s feet are visible."),
      );
      return;
    }
    const current = visible.map(measure);
    if (
      samples.length &&
      current.some(
        (p, i) =>
          Math.abs(p.x - samples[0][i].x) > 0.035 ||
          Math.abs(p.hipY - samples[0][i].hipY) > 0.035,
      )
    ) {
      samples = [];
      calibrationStart = 0;
    }
    if (!samples.length) calibrationStart = performance.now();
    samples.push(current);
    $("tracking-label").textContent =
      `Stand tall… ${Math.max(1, Math.ceil(3 - (performance.now() - calibrationStart) / 1000))}`;
    if (performance.now() - calibrationStart < 2500 || samples.length < 12)
      return;
    baselines = current.map((_, i) => ({
      x: 0,
      hipY: 0,
      shoulderY: 0,
      ankleY: 0,
      torso: 0,
    }));
    samples.forEach((sample) =>
      sample.forEach((value, i) => {
        for (const key of Object.keys(value) as (keyof Baseline)[])
          baselines[i][key] += value[key] / samples.length;
      }),
    );
    anchors = baselines.map((b) => ({ ...b }));
    lastSeen = anchors.map(() => performance.now());
    calibrating = false;
    calibrated = true;
    cameraLabel("The crew is connected.", "Your moves are ready to play.");
    showOverlay(
      `<p class="eyebrow">THAT’S YOUR CREW</p><h2>Looking good,<br>little blobs.</h2><p>From left to right in the preview<br><strong>${active()
        .map((p) => p.name)
        .join(
          " · ",
        )}</strong></p><button class="primary-button" id="camera-start">Let’s hit the trail</button><button class="text-button" id="recalibrate">Find our spots again</button>`,
    );
    $("camera-start").onclick = startRound;
    $("recalibrate").onclick = calibrate;
  }
  if (calibrated) {
    const matched = matchPoses(anchors, poses);
    motions = matched.map((pose, i) => {
      if (!pose) {
        if (performance.now() - lastSeen[i] < 500 && motions[i])
          return motions[i];
        return { action: "run", lean: 0, tracked: false };
      }
      lastSeen[i] = performance.now();
      anchors[i] = measure(pose);
      return interpret(pose, baselines[i]);
    });
    // Keep colors associated with player slots, even while someone is missing.
    drawJoints(matched.map((p) => p ?? []));
    const missing = motions.flatMap((motion, i) =>
      motion.tracked ? [] : [active()[i].name],
    );
    $("tracking-label").textContent = missing.length
      ? `Looking for ${missing.join(" & ")}`
      : "Everyone’s in view";
    if (missing.length) pause("Come back into view.");
  }
}
function calibrate() {
  if(space){calibrated=false;calibrating=false;$("overlay").hidden=true;hideIntro();return;}
  resetCalibration();
  calibrating = true;
  hideIntro();
  showOverlay(
    `<p class="eyebrow">FIND YOUR SPOT</p><h2>Everybody in?</h2><p>Left to right in the preview<br><strong>${active()
      .map((p) => p.name)
      .join(
        " · ",
      )}</strong></p><p id="calibration-message">Stand tall and still with your feet in view. Leave a little room between players.</p><button class="text-button" id="cancel-camera">Use buttons instead</button>`,
  );
  $("cancel-camera").onclick = stopCamera;
}
async function connectCamera() {
  if (phase !== "lobby") {
    notice("Go back to the crew to change controls.");
    return;
  }
  if (cameraLoading) return;
  if (tracker) {
    calibrate();
    return;
  }
  cameraLoading = true;
  ($("camera") as HTMLButtonElement).disabled = true;
  $("camera").textContent = "Connecting…";
  cameraLabel(
    "Opening your camera…",
    "Allow camera access when your browser asks.",
  );
  notice(
    "The first camera setup downloads the motion model. This can take a moment.",
  );
  // Keep the inline preview visible throughout Safari camera startup.
  $("camera-preview").hidden = false;
  $("camera-preview").scrollIntoView({ block: "nearest" });
  $("tracking-label").textContent = "Starting camera…";
  const currentTracker = new Tracker(
    $("video"),
    onPoses,
    (error) => {
      if (tracker !== currentTracker) return;
      stopCamera();
      cameraHelp.showFailure(error);
      notice(
        `${cameraAdvice(error.stage, error.name)} Open Camera help & diagnostics for details.`,
      );
    },
    cameraDiagnostics,
  );
  tracker = currentTracker;
  try {
    await currentTracker.start(cameraHelp.settings);
    if (tracker !== currentTracker) return;
    mode = "camera";
    cameraLoading = false;
    $("camera-preview").hidden = false;
    ($("camera") as HTMLButtonElement).disabled = false;
    $("camera").textContent = "Find our spots again";
    notice("Camera connected. Stand side by side and keep your feet in view.");
    calibrate();
  } catch (error) {
    if (tracker !== currentTracker) return;
    stopCamera();
    const failure =
      error instanceof CameraFailure
        ? error
        : new CameraFailure("permission", error);
    cameraHelp.showFailure(failure);
    notice(
      `${cameraAdvice(failure.stage, failure.name)} Open Camera help & diagnostics for details.`,
    );
  }
}
$("players").onclick = (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button",
  );
  if (!target) return;
  if (phase !== "lobby" || cameraLoading) {
    notice("Return to the crew before changing players.");
    return;
  }
  if (target.dataset.player !== undefined) {
    const p = players[Number(target.dataset.player)];
    if (p.active && active().length === 1) {
      notice("Keep at least one blob in the crew.");
      return;
    }
    p.active = !p.active;
  }
  if (target.dataset.color !== undefined)
    players[Number(target.dataset.owner)].color =
      colors[Number(target.dataset.color)];
  persist();
  renderPlayers();
  if (tracker) calibrate();
};
$("add-player").onclick = () => {
  if (players.length >= 4 || phase !== "lobby") return;
  players.push({
    id: `friend-${players.length}`,
    name: `Player ${players.length + 1}`,
    color: colors[players.length],
    active: true,
  });
  persist();
  renderPlayers();
  if (tracker) calibrate();
};
$("camera").onclick = connectCamera;
$("manual").onclick = () => {
  if (phase !== "lobby") {
    notice("Use the pause menu to return to the crew.");
    return;
  }
  stopCamera();
  startRound();
};
$("camera-stop").onclick = stopCamera;
$("pause").onclick = () => pause();
$("home").onclick = backToLobby;
$("how").onclick = () => {
  pause();
  $<HTMLDialogElement>("help").showModal();
};
$("close-help").onclick = () => $<HTMLDialogElement>("help").close();
$("close-install").onclick = () => $<HTMLDialogElement>("install-help").close();
$("sound").onclick = () => {
  sound = !sound;
  $("sound").setAttribute("aria-pressed", String(sound));
  $("sound").textContent = sound ? "Sound on" : "Sound off";
  if (sound) playTone();
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    notice("Full screen is unavailable in this browser.");
  }
};
$("touch-player").onchange = () => {
  touchPlayer = Number($<HTMLSelectElement>("touch-player").value);
  touchPressed.clear();
};
document
  .querySelectorAll<HTMLButtonElement>("[data-action]")
  .forEach((button) => {
    button.onpointerdown = (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      const action = button.dataset.action as Action;
      touchPressed.add(action);
      if (action === "jump") jumpUntil[touchPlayer] = performance.now() + 650;
    };
    button.onpointerup = button.onpointercancel = () =>
      touchPressed.delete(button.dataset.action as Action);
  });
window.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    document.querySelector("dialog[open]")
  )
    return;
  if (event.key === "Escape") {
    pause();
    return;
  }
  const key = event.key.toLowerCase();
  if (mode !== "buttons" || phase !== "running" || !keys.flat().includes(key))
    return;
  event.preventDefault();
  pressed.add(key);
  if (!event.repeat)
    active().forEach((player, i) => {
      const slot = players.findIndex((p) => p.id === player.id);
      if (key === keys[slot][2]) jumpUntil[i] = performance.now() + 650;
    });
});
window.addEventListener("keyup", (event) =>
  pressed.delete(event.key.toLowerCase()),
);
window.addEventListener("blur", () => {
  pressed.clear();
  touchPressed.clear();
  pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("pagehide", () => tracker?.stop());
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    stopCamera();
    notice("Welcome back. Connect your camera again to play.");
  }
});
function buttonMotions(now: number): Motion[] {
  return active().map((player, index) => {
    const mapping = keys[players.findIndex((p) => p.id === player.id)];
    const down = (action: Action, key: string) =>
      pressed.has(key) || (touchPlayer === index && touchPressed.has(action));
    let action: Action = "run";
    if (now < jumpUntil[index]) action = "jump";
    else if (down("duck", mapping[3])) action = "duck";
    else if (down("left", mapping[0])) action = "left";
    else if (down("right", mapping[1])) action = "right";
    return {
      action,
      lean: action === "left" ? -1 : action === "right" ? 1 : 0,
      tracked: true,
    };
  });
}
let last = performance.now(),
  lastScore = "";
function frame(now: number) {
  const delta = Math.min((now - last) / 1000, 0.08);
  last = now;
  if (mode === "buttons") motions = buttonMotions(now);
  if (mode === "camera" && calibrated && now - lastPoseAt > 2000) {
    motions = motions.map((m) => ({ ...m, tracked: false }));
    pause("Waiting for your camera.");
  }
  if (phase === "countdown") {
    countdown -= delta;
    if (countdown <= 0) {
      phase = "running";
      $("overlay").hidden = true;
    } else
      showOverlay(
        `<p class="eyebrow">HERE WE GO</p><h2 class="countdown-number">${Math.ceil(countdown)}</h2><p>Find your feet. Feel the beat.</p>`,
      );
  }
  if (phase === "running" && run) {
    run.update(delta, motions);
    $("time").textContent = String(
      Math.ceil(run.definition.duration - run.elapsed),
    );
    const score = run.scores.join(",");
    if (score !== lastScore) {
      renderScores();
      lastScore = score;
    }
    const next = run.upcoming;
    $("cue").hidden = !next;
    if (next) {
      const action =
        next.kind === "dodge"
          ? next.side === 1
            ? "Step left"
            : "Step right"
          : next.kind === "jump"
            ? "Jump up!"
            : "Duck down!";
      $("cue").textContent =
        `${action} · ${Math.max(0, Math.ceil(next.at - run.elapsed))}`;
    }
    if (run.finished) finish();
  }
  if(space) ride.draw(delta, players.map(p=>p.color));
  else renderer.draw(active(), motions, now / 1000, run);
  requestAnimationFrame(frame);
}
renderPlayers();
requestAnimationFrame(frame);

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let installPrompt: InstallPrompt | undefined;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
});
$("install").onclick = async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = undefined;
  } else $<HTMLDialogElement>("install-help").showModal();
};
window.addEventListener("appinstalled", () => {
  $("install").textContent = "App installed";
});
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}sw.js`,
      );
      await navigator.serviceWorker.ready;
      $("offline-status").textContent = "Ready for offline play";
      const offerUpdate = () => {
        if (!registration.waiting) return;
        const button = document.createElement("button");
        button.className = "text-button";
        button.textContent = "New playground update · reload";
        button.onclick = () => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => location.reload(),
            { once: true },
          );
          registration.waiting?.postMessage("activate");
        };
        $("offline-status").replaceChildren(button);
      };
      offerUpdate();
      registration.addEventListener("updatefound", () =>
        registration.installing?.addEventListener("statechange", offerUpdate),
      );
    } catch {
      $("offline-status").textContent =
        "Connect again to save for offline play.";
    }
  });
}
