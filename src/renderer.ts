import type { Motion, Player } from "./types";
import type { Run } from "./game";
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width = 1000;
  private height = 650;
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }
  draw(players: Player[], motions: Motion[], time: number, run?: Run) {
    const bounds = this.canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (
      this.canvas.width !== Math.round(bounds.width * ratio) ||
      this.canvas.height !== Math.round(bounds.height * ratio)
    ) {
      this.canvas.width = Math.round(bounds.width * ratio);
      this.canvas.height = Math.round(bounds.height * ratio);
    }
    this.width = bounds.width;
    this.height = bounds.height;
    const c = this.ctx,
      w = this.width,
      h = this.height;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#e7e0f6");
    sky.addColorStop(0.55, "#fff0db");
    sky.addColorStop(1, "#ffdbb9");
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    this.circle(w * 0.77, h * 0.22, Math.min(w, h) * 0.09, "#ffe5a9");
    this.cloud(w * 0.15, h * 0.24, w * 0.09);
    this.cloud(w * 0.83, h * 0.37, w * 0.07);
    this.cloud(w * 0.49, h * 0.13, w * 0.05);
    this.hill(
      "#bcc8ad",
      [0, 0.58, 0.1, 0.31, 0.25, 0.56, 0.38, 0.42, 0.55, 0.56, 1, 0.5],
      w,
      h,
    );
    this.hill(
      "#8fae96",
      [0, 0.65, 0.15, 0.49, 0.37, 0.62, 0.63, 0.35, 0.81, 0.6, 1, 0.54],
      w,
      h,
    );
    this.hill(
      "#c4d4a8",
      [0, 0.72, 0.22, 0.55, 0.4, 0.67, 0.68, 0.56, 0.86, 0.73, 1, 0.66],
      w,
      h,
    );
    const horizon = h * 0.49;
    c.fillStyle = "#bacd9c";
    c.fillRect(0, h * 0.71, w, h * 0.29);
    // A single broad trail with a colored edge and dashed perspective markers.
    this.path(
      [
        [w * 0.46, horizon],
        [w * 0.54, horizon],
        [w * 1.05, h],
        [w * -0.05, h],
      ],
      "#c4b3d9",
    );
    this.path(
      [
        [w * 0.468, horizon],
        [w * 0.532, horizon],
        [w * 0.99, h],
        [w * 0.01, h],
      ],
      "#e3d5e9",
    );
    for (let p = 0; p < 14; p++) {
      const depth = (p / 14 + (run ? run.elapsed * 0.13 : time * 0.018)) % 1;
      const y = horizon + depth * depth * (h - horizon);
      const span = w * 0.032 + depth * depth * w * 0.45;
      c.strokeStyle = "#f9f0f6";
      c.lineWidth = Math.max(1, depth * 3);
      c.setLineDash([8 * depth + 2, 6 * depth + 2]);
      c.beginPath();
      c.moveTo(w * 0.5 - span, y);
      c.lineTo(w * 0.5 + span, y);
      c.stroke();
    }
    c.setLineDash([]);
    for (let i = 0; i < 22; i++) {
      const p = (i * 0.137) % 1,
        side = i % 2 ? 1 : -1;
      const y = horizon + (h - horizon) * p;
      const x = w * 0.5 + side * (w * 0.1 + w * 0.46 * p + (i % 3) * w * 0.08);
      const size = 3 + p * 7;
      c.strokeStyle = "#7e9d70";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - size * 0.5, y - size);
      c.moveTo(x, y);
      c.lineTo(x + size * 0.6, y - size * 0.8);
      c.stroke();
      if (i % 3 === 0)
        this.circle(x, y - size, size * 0.42, i % 2 ? "#fff5c2" : "#edb8b2");
    }
    const count = players.length;
    if (run)
      for (const obstacle of [...run.obstacles].reverse()) {
        const progress = 1 - (obstacle.at - run.elapsed) / run.definition.speed;
        if (progress < 0 || progress > 1.15) continue;
        const depth = Math.pow(progress, 1.6);
        const y = horizon + depth * (h * 0.81 - horizon);
        const scale = 0.12 + depth * 0.88;
        for (let i = 0; i < count; i++) {
          const worldX = ((i + 0.5) / count - 0.5) * w * 0.72;
          const x = w * 0.5 + worldX * scale;
          const size = Math.min((w / count) * 0.32, 100) * scale;
          c.save();
          c.translate(x, y);
          if (obstacle.kind === "jump") {
            this.round(
              -size * 0.8,
              -size * 0.3,
              size * 1.6,
              size * 0.34,
              8 * scale,
              "#ef9879",
            );
            this.round(
              -size * 0.8,
              -size * 0.3,
              size * 1.6,
              size * 0.1,
              6 * scale,
              "#ffd0a6",
            );
            for (let k = -1; k <= 1; k++)
              this.circle(k * size * 0.42, -size * 0.15, 3 * scale, "#bc6e64");
          } else if (obstacle.kind === "duck") {
            this.round(
              -size * 0.8,
              -size * 1.35,
              9 * scale,
              size * 1.35,
              4,
              "#847397",
            );
            this.round(
              size * 0.8 - 9 * scale,
              -size * 1.35,
              9 * scale,
              size * 1.35,
              4,
              "#847397",
            );
            this.round(
              -size * 0.94,
              -size * 1.4,
              size * 1.88,
              size * 0.4,
              7 * scale,
              "#a18ac3",
            );
            c.fillStyle = "#e4d6f3";
            c.fillRect(-size * 0.65, -size * 1.32, size * 1.3, 4 * scale);
          } else {
            c.translate(obstacle.side * size * 0.48, 0);
            this.round(
              -size * 0.48,
              -size * 0.92,
              size * 0.96,
              size * 0.92,
              18 * scale,
              "#d1978b",
            );
            this.round(
              -size * 0.35,
              -size * 0.88,
              size * 0.7,
              size * 0.18,
              8 * scale,
              "#edb3a1",
            );
            c.strokeStyle = "#aa746d";
            c.lineWidth = 2 * scale;
            c.beginPath();
            c.moveTo(-size * 0.2, -size * 0.55);
            c.lineTo(size * 0.15, -size * 0.23);
            c.stroke();
          }
          c.restore();
        }
      }
    players.forEach((player, index) => {
      const motion = motions[index] ?? {
        action: "run",
        lean: 0,
        tracked: true,
      };
      const size = Math.min((w / count) * 0.25, h * 0.17, 105);
      const x =
        w * 0.5 +
        ((index + 0.5) / count - 0.5) * w * 0.72 +
        motion.lean * Math.min((w / count) * 0.13, 70);
      const y = h * 0.84;
      this.blob(x, y, size, player.color, motion, time, index);
      if (!run) {
        c.font = '600 14px "DM Sans", sans-serif';
        c.textAlign = "center";
        c.fillStyle = "#554566";
        c.fillText(player.name, x, y + size * 0.38);
      } else if (run.feedback[index].until > run.elapsed) {
        c.font = '700 14px "DM Sans", sans-serif';
        c.textAlign = "center";
        c.fillStyle = "#554566";
        c.fillText(run.feedback[index].text, x, y - size * 2.1);
      }
    });
  }
  private blob(
    x: number,
    y: number,
    s: number,
    color: string,
    motion: Motion,
    time: number,
    index: number,
  ) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.fillStyle = "#79677e22";
    c.beginPath();
    c.ellipse(0, 0, s * 0.68, s * 0.17, 0, 0, Math.PI * 2);
    c.fill();
    const duck = motion.action === "duck",
      jump = motion.action === "jump";
    c.translate(0, jump ? -s * 0.7 : Math.sin(time * 4 + index) * s * 0.025);
    c.scale(duck ? 1.18 : 1, duck ? 0.55 : 1);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = color;
    c.lineWidth = s * 0.24;
    let left = { x: -0.77, y: -0.63 },
      right = { x: 0.77, y: -0.7 };
    if (motion.joints) {
      const pose = motion.joints,
        torso = Math.max(
          0.06,
          (pose[23].y + pose[24].y - pose[12].y - pose[11].y) / 2,
        );
      left = {
        x: Math.max(
          -1.3,
          Math.min(0.2, -0.38 - ((pose[15].x - pose[11].x) / torso) * 0.5),
        ),
        y: Math.max(
          -2,
          Math.min(-0.15, -1.05 + ((pose[15].y - pose[11].y) / torso) * 0.55),
        ),
      };
      right = {
        x: Math.max(
          -0.2,
          Math.min(1.3, 0.38 - ((pose[16].x - pose[12].x) / torso) * 0.5),
        ),
        y: Math.max(
          -2,
          Math.min(-0.15, -1.05 + ((pose[16].y - pose[12].y) / torso) * 0.55),
        ),
      };
    } else if (jump) {
      left.y = -1.6;
      right.y = -1.6;
    }
    c.beginPath();
    c.moveTo(-s * 0.4, -s * 1.03);
    c.quadraticCurveTo(-s * 0.65, -s * 0.9, left.x * s, left.y * s);
    c.moveTo(s * 0.4, -s * 1.03);
    c.quadraticCurveTo(s * 0.65, -s * 0.9, right.x * s, right.y * s);
    c.stroke();
    const step = Math.sin(time * 8 + index * 2) * s * 0.065;
    c.beginPath();
    c.moveTo(-s * 0.23, -s * 0.3);
    c.lineTo(-s * 0.28, -s * 0.04 + step);
    c.moveTo(s * 0.23, -s * 0.3);
    c.lineTo(s * 0.28, -s * 0.04 - step);
    c.stroke();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, -s * 1.76);
    c.bezierCurveTo(
      s * 0.48,
      -s * 1.76,
      s * 0.44,
      -s * 1.2,
      s * 0.57,
      -s * 0.7,
    );
    c.bezierCurveTo(
      s * 0.76,
      -s * 0.12,
      -s * 0.72,
      -s * 0.12,
      -s * 0.57,
      -s * 0.7,
    );
    c.bezierCurveTo(-s * 0.44, -s * 1.2, -s * 0.48, -s * 1.76, 0, -s * 1.76);
    c.fill();
    c.fillStyle = "#ffffff25";
    c.beginPath();
    c.ellipse(-s * 0.17, -s * 1.43, s * 0.13, s * 0.22, 0.3, 0, Math.PI * 2);
    c.fill();
    this.circle(-s * 0.17, -s * 1.18, s * 0.045, "#29273f");
    this.circle(s * 0.17, -s * 1.18, s * 0.045, "#29273f");
    c.strokeStyle = "#29273f";
    c.lineWidth = s * 0.025;
    c.beginPath();
    c.arc(0, -s * 1.09, s * 0.1, 0.1, Math.PI - 0.1);
    c.stroke();
    this.circle(-s * 0.28, -s * 1.04, s * 0.065, "#ffffff36");
    this.circle(s * 0.28, -s * 1.04, s * 0.065, "#ffffff36");
    c.restore();
  }
  private circle(x: number, y: number, r: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();
  }
  private round(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string,
  ) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    this.ctx.fill();
  }
  private path(points: number[][], color: string) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
  }
  private cloud(x: number, y: number, s: number) {
    this.circle(x - s * 0.32, y, s * 0.23, "#fff9edb0");
    this.circle(x, y - s * 0.14, s * 0.32, "#fff9edb0");
    this.circle(x + s * 0.32, y, s * 0.22, "#fff9edb0");
    this.round(x - s * 0.5, y, s, s * 0.18, s * 0.08, "#fff9edb0");
  }
  private hill(color: string, p: number[], w: number, h: number) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(p[0] * w, p[1] * h);
    for (let i = 2; i < p.length - 2; i += 4)
      c.quadraticCurveTo(p[i] * w, p[i + 1] * h, p[i + 2] * w, p[i + 3] * h);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
  }
}
