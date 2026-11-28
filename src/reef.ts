import type { Pose } from "./types";
import { UpperBodyTracker, type Point } from "./upper-body";
import { ReefGame, type Feelers } from "./reef-game";
const TAU = Math.PI * 2;
const palettes = [
  ["#72deff", "#91f4bd", "#ef9bff", "#ffc88d", "#ff95ba", "#b8b1ff"],
  ["#a5b9ff", "#90f3d5", "#ffb8db", "#ffe99d", "#7ae4ff", "#d5acff"],
];
export class MoonlightReef {
  readonly game = new ReefGame();
  readonly tracking = new UpperBodyTracker();
  pointer?: Point;
  held = false;
  keys = new Set<string>();
  private keyboard: Point = { x: 0.5, y: 0.6 };
  private keyboardActive = false;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private trails = new Map<string, Point[]>();
  constructor(private canvas: HTMLCanvasElement) {}
  accept(poses: Pose[]) {
    this.tracking.accept(poses, performance.now());
  }
  clearInput() {
    this.pointer = undefined;
    this.held = false;
    this.keys.clear();
    this.keyboardActive = false;
    this.trails.clear();
  }
  private circle(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string | CanvasGradient,
  ) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, TAU);
    c.fill();
  }
  private glow(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
  ) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    this.circle(c, x, y, r, g);
  }
  draw(dt: number, colors: string[], paused = false) {
    const c = this.canvas.getContext("2d")!,
      w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    if (
      this.canvas.width !== Math.round(w * dpr) ||
      this.canvas.height !== Math.round(h * dpr)
    ) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const now = performance.now(),
      swimmers = this.tracking.visible(now),
      hands: Feelers[] = [];
    for (const s of swimmers) {
      if (now - s.seen > 350) continue;
      s.hands.forEach((p, i) => {
        if (p)
          hands.push({
            key: `${s.id}:${i}`,
            point: p,
            current: s.open,
            color: colors[s.id % colors.length],
          });
      });
    }
    const move = {
      x:
        Number(this.keys.has("arrowright") || this.keys.has("d")) -
        Number(this.keys.has("arrowleft") || this.keys.has("a")),
      y:
        Number(this.keys.has("arrowdown") || this.keys.has("s")) -
        Number(this.keys.has("arrowup") || this.keys.has("w")),
    };
    if (move.x || move.y || this.keys.has(" ")) this.keyboardActive = true;
    this.keyboard.x = Math.max(
      0.04,
      Math.min(0.96, this.keyboard.x + (move.x * dt * 0.42) / (w / h)),
    );
    this.keyboard.y = Math.max(
      0.16,
      Math.min(0.84, this.keyboard.y + move.y * dt * 0.42),
    );
    const manual =
      this.pointer ?? (this.keyboardActive ? this.keyboard : undefined);
    if (manual)
      hands.push({
        key: "manual",
        point: manual,
        current: this.held || this.keys.has(" "),
        color: colors[0],
      });
    if (!paused) this.game.update(dt, hands, w / h);
    const t = this.reduced ? 0 : this.game.time,
      palette = palettes[this.game.cycle % palettes.length];
    const bg = c.createLinearGradient(0, 0, w * 0.4, h);
    bg.addColorStop(0, "#103d54");
    bg.addColorStop(0.4, "#092b43");
    bg.addColorStop(1, "#080e26");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    this.glow(c, w * 0.5, -h * 0.12, w * 0.6, "#4bb2bd32");
    // Slow ribbons of moonlight through the water.
    for (let i = 0; i < 7; i++) {
      c.fillStyle = `rgba(120,239,227,${0.018 + Math.sin(i) * 0.007})`;
      c.beginPath();
      c.moveTo(w * (0.12 + i * 0.13), 0);
      c.lineTo(w * (0.04 + i * 0.15) + Math.sin(t * 0.12 + i) * 50, h);
      c.lineTo(w * (0.17 + i * 0.15) + Math.sin(t * 0.12 + i) * 50, h);
      c.lineTo(w * (0.17 + i * 0.13), 0);
      c.fill();
    }
    for (let layer = 0; layer < 3; layer++) {
      c.fillStyle = ["#123747", "#102a3e", "#0a1d33"][layer];
      c.beginPath();
      c.moveTo(0, h);
      for (let i = 0; i <= 24; i++) {
        const x = (i / 24) * w,
          y =
            h * (0.81 + layer * 0.055) -
            Math.sin(i * 0.73 + layer * 2) * h * 0.035 -
            Math.sin(i * 1.8) * h * 0.018;
        c.quadraticCurveTo(x - w / 48, y, x, y);
      }
      c.lineTo(w, h);
      c.fill();
    }
    // Distant fish schools and plankton: deterministic, never allocate scenery.
    for (let i = 0; i < 18; i++) {
      const x = (((i * 0.173 + t * 0.008) % 1.2) - 0.1) * w,
        y = (0.24 + ((i * 0.071) % 0.48)) * h;
      c.save();
      c.translate(x, y);
      c.scale(i % 2 ? 1 : -1, 1);
      c.fillStyle = "#77cfc922";
      c.beginPath();
      c.ellipse(0, 0, 9, 3, 0, 0, TAU);
      c.moveTo(-7, 0);
      c.lineTo(-14, -5);
      c.lineTo(-14, 5);
      c.fill();
      c.restore();
    }
    for (let i = 0; i < 65; i++) {
      const x = ((i * 0.618033 + Math.sin(t * 0.1 + i) * 0.008) % 1) * w,
        y = (1 - ((i * 0.38197 + t * 0.006) % 1)) * h;
      this.circle(
        c,
        x,
        y,
        i % 4 === 0 ? 2 : 1,
        `rgba(168,248,235,${0.08 + (i % 5) * 0.035})`,
      );
    }
    // A distant guardian hints at the shared reward before it wakes.
    if (!this.game.celebration) {
      c.save();
      c.globalAlpha = 0.055;
      this.whale(c, w * 0.76, h * 0.2, Math.min(w * 0.17, h * 0.2), t);
      c.restore();
    }
    // Tall sea grass frames the playable clearing.
    for (let side = 0; side < 2; side++)
      for (let i = 0; i < 15; i++) {
        const x = side ? w - i * w * 0.012 : i * w * 0.012,
          height = h * (0.12 + (i % 5) * 0.052),
          sway = Math.sin(t * 0.6 + i) * 12;
        c.strokeStyle = i % 2 ? "#206365" : "#174750";
        c.lineWidth = 4 + (i % 4);
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(x, h);
        c.bezierCurveTo(
          x + 25,
          h - height * 0.35,
          x - 20 + sway,
          h - height * 0.65,
          x + sway,
          h - height,
        );
        c.stroke();
      }
    // Six coral gardens turn on one by one, with softly growing light.
    for (let i = 0; i < 6; i++) {
      const x = w * (0.11 + i * 0.156),
        y = h * 0.94,
        scale = Math.min(w / 950, h / 640),
        lit = Math.max(0, Math.min(1, (this.game.collected - i * 4) / 4));
      this.glow(
        c,
        x,
        y - 35 * scale,
        110 * scale,
        `${palette[i]}${Math.round(8 + lit * 30)
          .toString(16)
          .padStart(2, "0")}`,
      );
      c.save();
      c.translate(x, y);
      c.scale(scale, scale);
      c.fillStyle = "#152d40";
      c.beginPath();
      c.ellipse(0, 4, 67, 19, 0, 0, TAU);
      c.fill();
      c.strokeStyle = lit > 0 ? palette[i] : "#365366";
      c.globalAlpha = 0.4 + lit * 0.6;
      c.lineWidth = 7;
      c.lineCap = "round";
      for (let j = 0; j < 7; j++) {
        const ex = (j - 3) * 17,
          ey = -35 - (3 - Math.abs(j - 3)) * 19,
          sway = Math.sin(t * 0.7 + i + j) * 3;
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(ex * 0.1, -32, ex + sway, ey * 0.6, ex + sway, ey);
        c.stroke();
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(ex * 0.6, ey * 0.55);
        c.quadraticCurveTo(
          ex + (j % 2 ? 16 : -16),
          ey * 0.6,
          ex + (j % 2 ? 19 : -19),
          ey * 0.78,
        );
        c.stroke();
        c.lineWidth = 7;
        if (lit > 0) {
          this.circle(c, ex + sway, ey, 4 + lit * 3, "#ecfff2");
          this.circle(c, ex + sway, ey, 2, palette[i]);
        }
      }
      c.restore();
      for (let j = 0; j < 5; j++) {
        const px = x + (j - 2) * 12 * scale,
          py = y + 12 * scale;
        this.circle(
          c,
          px,
          py,
          (6 - (j % 2)) * scale,
          lit ? palette[i] : "#314354",
        );
      }
    }
    for (const p of this.game.pearls) {
      const x = p.x * w,
        y = p.y * h,
        r = Math.min(w, h) * (0.012 + Math.sin(t * 1.8 + p.phase) * 0.0015) + 4;
      this.glow(c, x, y, r * 4, "#ffe8a025");
      c.strokeStyle = "#ffeabc52";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(x, y, r + 6, 0, TAU);
      c.stroke();
      const pg = c.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r);
      pg.addColorStop(0, "#ffffff");
      pg.addColorStop(0.35, "#fff9da");
      pg.addColorStop(1, "#e5b86e");
      this.circle(c, x, y, r, pg);
      this.circle(c, x - r * 0.25, y - r * 0.3, r * 0.22, "white");
      c.strokeStyle = "#fff5c277";
      c.beginPath();
      c.moveTo(x + r * 1.9, y - 3);
      c.lineTo(x + r * 1.9, y + 3);
      c.moveTo(x + r * 1.9 - 3, y);
      c.lineTo(x + r * 1.9 + 3, y);
      c.stroke();
    }
    // Every live participant has a small, colored jellyfish and two feelers.
    for (const s of swimmers) {
      const alpha = Math.max(0, Math.min(1, (1200 - (now - s.seen)) / 700)),
        x = s.center.x * w,
        y = s.center.y * h,
        color = colors[s.id % colors.length];
      c.save();
      c.globalAlpha = alpha;
      for (const p of s.hands) {
        if (!p) continue;
        c.strokeStyle = color + "70";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x, y + 15);
        c.bezierCurveTo(x, y + 70, p.x * w, p.y * h + 60, p.x * w, p.y * h);
        c.stroke();
      }
      this.jelly(c, x, y, Math.min(w, h) * 0.045 + 8, color, t + s.id);
      c.restore();
    }
    if (manual)
      this.jelly(c, manual.x * w, manual.y * h + 30, 26, colors[0], t);
    const liveKeys = new Set(hands.map((hand) => hand.key));
    for (const key of this.trails.keys())
      if (!liveKeys.has(key)) this.trails.delete(key);
    for (const hand of hands) {
      const x = hand.point.x * w,
        y = hand.point.y * h,
        color = hand.color,
        trail = this.trails.get(hand.key) ?? [];
      if (!paused) {
        trail.push({ ...hand.point });
        if (trail.length > 16) trail.shift();
        this.trails.set(hand.key, trail);
      }
      trail.forEach((p, i) =>
        this.circle(
          c,
          p.x * w,
          p.y * h,
          2 + i * 0.25,
          color +
            Math.round((i / trail.length) * 100)
              .toString(16)
              .padStart(2, "0"),
        ),
      );
      if (hand.current) {
        for (let i = 0; i < 3; i++) {
          const r = ((t * 0.35 + i / 3) % 1) * h * 0.22;
          c.strokeStyle = color + "30";
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, y, r, t + i, t + i + Math.PI * 1.5);
          c.stroke();
        }
      }
      this.glow(c, x, y, 38, color + "44");
      this.circle(c, x, y, 12, color);
      this.circle(c, x - 2, y - 3, 5, "#efffff");
    }
    for (const f of this.game.flights) {
      const ease = 1 - (1 - f.progress) ** 3,
        x = (f.from.x + (0.11 + f.garden * 0.156 - f.from.x) * ease) * w,
        y =
          (f.from.y + (0.91 - f.from.y) * ease) * h -
          Math.sin(f.progress * Math.PI) * h * 0.15;
      this.glow(c, x, y, 20, f.color + "55");
      this.circle(c, x, y, 5, f.color);
    }
    for (const s of this.game.sparks) {
      c.globalAlpha = Math.min(1, s.life * 2);
      this.circle(c, s.x * w, s.y * h, 3, s.color);
    }
    c.globalAlpha = 1;
    // The entire goal is visual: six sleeping buds become six bright flowers.
    const hudY = w < 600 ? 100 : 43,
      spacing = w < 600 ? 30 : 38,
      hudW = spacing * 6 + 28;
    c.fillStyle = "#071f3299";
    c.strokeStyle = "#a1ded224";
    c.lineWidth = 1;
    c.beginPath();
    c.roundRect(w / 2 - hudW / 2, hudY - 20, hudW, 40, 20);
    c.fill();
    c.stroke();
    for (let i = 0; i < 6; i++) {
      const x = w / 2 + (i - 2.5) * spacing,
        lit = this.game.collected >= (i + 1) * 4;
      if (lit) {
        for (let j = 0; j < 5; j++)
          this.circle(
            c,
            x + Math.cos((j / 5) * TAU) * 6,
            hudY + Math.sin((j / 5) * TAU) * 6,
            5,
            palette[i],
          );
        this.circle(c, x, hudY, 3, "#fff8d4");
      } else {
        c.strokeStyle = "#9cc1c5";
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(x, hudY, 5, 8, 0.3, 0, TAU);
        c.stroke();
        const amount = Math.max(0, (this.game.collected - i * 4) / 4);
        if (amount > 0) {
          c.strokeStyle = palette[i];
          c.lineWidth = 3;
          c.beginPath();
          c.arc(x, hudY, 12, -Math.PI / 2, -Math.PI / 2 + amount * TAU);
          c.stroke();
        }
      }
    }
    // Small illustrated moon emblem, no written title.
    this.circle(c, 36, 40, 16, "#b9f4db");
    this.circle(c, 43, 34, 14, "#133d51");
    this.circle(c, 54, 22, 2, "#fff7cf");
    if (!hands.length && !swimmers.length && !this.game.celebration) {
      const gx = w * 0.5,
        gy = h * 0.68;
      c.save();
      c.globalAlpha = 0.7;
      this.jelly(c, gx, gy, 36, "#a5dfed", t);
      c.restore();
      // A reaching silhouette shows the gesture without language.
      const phase = (Math.sin(t * 1.5) + 1) / 2,
        tx = gx + 36 + phase * 25,
        ty = gy - 40 - phase * 25;
      c.strokeStyle = "#ddfff3a0";
      c.lineWidth = 3;
      c.lineCap = "round";
      c.beginPath();
      c.arc(gx, gy + 95, 7, 0, TAU);
      c.moveTo(gx, gy + 104);
      c.lineTo(gx, gy + 127);
      c.moveTo(gx - 20, gy + 118);
      c.lineTo(gx, gy + 108);
      c.lineTo(gx + 15 + phase * 15, gy + 98 - phase * 12);
      c.moveTo(gx, gy + 108);
      c.lineTo(gx - 15 - phase * 15, gy + 98 - phase * 12);
      c.stroke();
      c.setLineDash([3, 7]);
      c.strokeStyle = "#d7f9eb50";
      c.beginPath();
      c.moveTo(gx + 20, gy);
      c.quadraticCurveTo(tx + 15, gy - 10, tx, ty);
      c.stroke();
      c.setLineDash([]);
    }
    if (this.game.celebration) {
      const p = 1 - this.game.celebration / 8,
        x = this.reduced ? w * 0.5 : (-0.45 + p * 1.9) * w,
        y = h * 0.43 + Math.sin(p * Math.PI) * h * 0.03;
      this.glow(c, w * 0.5, h * 0.45, w * 0.6, "#72e6db14");
      this.whale(c, x, y, Math.min(w * 0.33, h * 0.43), t);
      for (let i = 0; i < 45; i++) {
        const sx = ((i * 0.618) % 1) * w,
          sy = ((i * 0.173 + p * 0.3) % 1) * h;
        c.globalAlpha = Math.sin(p * Math.PI) * 0.6;
        this.circle(c, sx, sy, 2 + (i % 3), palette[i % 6]);
      }
      c.globalAlpha = 1;
    }
    // Quiet foreground scallops give depth without blocking the hands.
    c.fillStyle = "#071829";
    c.beginPath();
    c.moveTo(0, h);
    for (let i = 0; i <= 30; i++)
      c.lineTo((i / 30) * w, h - 8 - Math.sin(i * 0.8) * 6);
    c.lineTo(w, h);
    c.fill();
  }
  private jelly(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
    t: number,
  ) {
    const pulse = 1 + Math.sin(t * 2) * 0.045;
    c.save();
    c.translate(x, y);
    c.scale(pulse, 1 / pulse);
    this.glow(c, 0, 0, r * 2.6, color + "20");
    for (let i = 0; i < 5; i++) {
      const sx = (i - 2) * r * 0.3;
      c.strokeStyle = color + "88";
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(sx, r * 0.3);
      c.bezierCurveTo(
        sx - 12 + Math.sin(t * 2 + i) * 10,
        r * 0.9,
        sx + 15,
        r * 1.2,
        sx + Math.sin(t * 1.5 + i) * 12,
        r * 1.65,
      );
      c.stroke();
    }
    const fill = c.createLinearGradient(0, -r, 0, r * 0.6);
    fill.addColorStop(0, "#ecffff");
    fill.addColorStop(0.2, color);
    fill.addColorStop(1, color + "80");
    c.fillStyle = fill;
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-r, r * 0.2);
    c.bezierCurveTo(-r * 1.1, -r * 1.15, r * 1.1, -r * 1.15, r, r * 0.2);
    c.quadraticCurveTo(r * 0.5, r * 0.55, 0, r * 0.3);
    c.quadraticCurveTo(-r * 0.5, r * 0.55, -r, r * 0.2);
    c.fill();
    c.stroke();
    c.strokeStyle = "#efffff88";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-r * 0.6, -r * 0.3);
    c.quadraticCurveTo(-r * 0.4, -r * 0.65, -r * 0.1, -r * 0.64);
    c.stroke();
    for (const side of [-1, 1]) {
      this.circle(c, side * r * 0.29, -r * 0.05, r * 0.095, "#12354b");
      this.circle(c, side * r * 0.29 - r * 0.025, -r * 0.08, r * 0.025, "#fff");
      this.circle(c, side * r * 0.49, r * 0.1, r * 0.1, "#ffb4cc77");
    }
    c.strokeStyle = "#19445a";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, r * 0.03, r * 0.1, 0.1, Math.PI - 0.1);
    c.stroke();
    c.restore();
  }
  private whale(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    t: number,
  ) {
    c.save();
    c.translate(x, y);
    c.scale(r / 200, r / 200);
    this.glow(c, 0, 0, 270, "#94ffe921");
    const g = c.createLinearGradient(0, -80, 0, 80);
    g.addColorStop(0, "#baf5ef");
    g.addColorStop(0.45, "#63bfc9");
    g.addColorStop(1, "#2e718a");
    c.fillStyle = g;
    c.strokeStyle = "#caffeb";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-110, 20);
    c.bezierCurveTo(-140, -25, -160, -60, -205, -50);
    c.quadraticCurveTo(-190, -10, -145, 20);
    c.quadraticCurveTo(-188, 27, -194, 65);
    c.quadraticCurveTo(-144, 65, -111, 37);
    c.bezierCurveTo(-35, 115, 160, 100, 173, 7);
    c.bezierCurveTo(183, -87, 10, -113, -75, -48);
    c.quadraticCurveTo(-105, -22, -110, 20);
    c.fill();
    c.stroke();
    c.fillStyle = "#9ee5dd88";
    c.beginPath();
    c.moveTo(-80, 35);
    c.bezierCurveTo(12, 80, 120, 56, 170, 10);
    c.bezierCurveTo(147, 93, -4, 108, -80, 35);
    c.fill();
    c.fillStyle = "#4c9cac";
    c.beginPath();
    c.moveTo(15, 40);
    c.quadraticCurveTo(-15, 115, -72, 104 + Math.sin(t) * 8);
    c.quadraticCurveTo(-27, 64, -24, 32);
    c.fill();
    this.circle(c, 127, -5, 7, "#102e45");
    this.circle(c, 129, -7, 2, "white");
    c.strokeStyle = "#226075";
    c.beginPath();
    c.arc(139, 8, 17, 0.4, 1.9);
    c.stroke();
    for (let i = 0; i < 14; i++)
      this.circle(
        c,
        -65 + (i % 7) * 23,
        -28 - Math.floor(i / 7) * 20,
        2,
        "#d9fff2aa",
      );
    c.restore();
  }
}
