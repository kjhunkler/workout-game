import type { Point } from "./upper-body";
export type Feelers = {
  key: string;
  point: Point;
  current: boolean;
  color: string;
};
export type Pearl = Point & { id: number; phase: number };
export type Spark = Point & {
  vx: number;
  vy: number;
  life: number;
  color: string;
};
export type Flight = Point & {
  from: Point;
  progress: number;
  color: string;
  garden: number;
};
export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export class ReefGame {
  time = 0;
  collected = 0;
  cycle = 0;
  celebration = 0;
  pearls: Pearl[] = [];
  sparks: Spark[] = [];
  flights: Flight[] = [];
  onCollect?: () => void;
  private serial = 0;
  private previous = new Map<string, Point>();
  constructor(private random = Math.random) {
    this.populate();
  }
  private populate() {
    while (this.pearls.length < 14)
      this.pearls.push({
        id: this.serial++,
        x: 0.1 + this.random() * 0.8,
        y: 0.22 + this.random() * 0.53,
        phase: this.random() * Math.PI * 2,
      });
  }
  update(dt: number, hands: Feelers[], aspect: number) {
    dt = Math.min(0.08, Math.max(0, dt));
    this.time += dt;
    const metric = (p: Point) => ({ x: p.x * aspect, y: p.y });
    this.sparks = this.sparks.filter((s) => {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += dt * 0.015;
      return s.life > 0;
    });
    this.flights = this.flights.filter((f) => (f.progress += dt * 0.85) < 1);
    if (this.celebration > 0) {
      this.celebration -= dt;
      this.previous.clear();
      if (this.celebration <= 0) {
        this.celebration = 0;
        this.cycle++;
        this.collected = 0;
        this.pearls = [];
        this.populate();
      }
      return;
    }
    for (const p of this.pearls) {
      p.x += Math.sin(this.time * 0.5 + p.phase) * dt * 0.008;
      p.y += Math.cos(this.time * 0.7 + p.phase) * dt * 0.006;
      for (const hand of hands) {
        const dx = hand.point.x - p.x,
          dy = hand.point.y - p.y,
          d = Math.hypot(dx * aspect, dy);
        if (hand.current && d < 0.28) {
          p.x += dx * dt * 1.5;
          p.y += dy * dt * 1.5;
        }
      }
      p.x = Math.max(0.05, Math.min(0.95, p.x));
      p.y = Math.max(0.18, Math.min(0.82, p.y));
    }
    this.pearls = this.pearls.filter((p) => {
      const hand = hands.find((h) => {
        const previous = this.previous.get(h.key) ?? h.point;
        // Reacquisition or teleports must not collect everything along a gap.
        const start =
          Math.hypot(previous.x - h.point.x, previous.y - h.point.y) < 0.2
            ? previous
            : h.point;
        return (
          segmentDistance(metric(p), metric(start), metric(h.point)) < 0.057
        );
      });
      if (!hand || this.collected >= 24) return true;
      this.flights.push({
        ...p,
        from: { x: p.x, y: p.y },
        progress: 0,
        color: hand.color,
        garden: Math.floor(this.collected / 4),
      });
      this.collected++;
      this.onCollect?.();
      for (let i = 0; i < 12; i++) {
        const a = this.random() * Math.PI * 2,
          s = 0.02 + this.random() * 0.08;
        this.sparks.push({
          ...p,
          vx: (Math.cos(a) * s) / aspect,
          vy: Math.sin(a) * s,
          life: 0.4 + this.random() * 0.5,
          color: hand.color,
        });
      }
      if (this.collected === 24) this.celebration = 8;
      return false;
    });
    this.sparks = this.sparks.slice(-240);
    this.previous = new Map(hands.map((h) => [h.key, { ...h.point }]));
    if (!this.celebration) this.populate();
  }
}
