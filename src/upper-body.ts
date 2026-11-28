import type { Landmark, Pose } from "./types";
export type Point = { x: number; y: number };
export type Swimmer = {
  id: number;
  center: Point;
  hands: (Point | undefined)[];
  open: boolean;
  seen: number;
};
const valid = (p?: Landmark): p is Landmark =>
  !!p &&
  (p.visibility ?? 0) >= 0.45 &&
  Number.isFinite(p.x) &&
  Number.isFinite(p.y);
const mirrored = (p: Landmark): Point => ({
  x: Math.max(0, Math.min(1, 1 - p.x)),
  y: Math.max(0, Math.min(1, p.y)),
});
const mix = (a: Point, b: Point): Point => ({
  x: a.x + (b.x - a.x) * 0.65,
  y: a.y + (b.y - a.y) * 0.65,
});
export function upperBody(pose: Pose) {
  if (!valid(pose[11]) || !valid(pose[12])) return;
  const left = mirrored(pose[11]),
    right = mirrored(pose[12]);
  const center = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const hands = [15, 16].map((i) =>
    valid(pose[i]) ? mirrored(pose[i]) : undefined,
  );
  const width = Math.max(0.06, Math.abs(left.x - right.x));
  const open =
    hands.every((p) => p !== undefined) &&
    Math.abs(hands[0]!.x - hands[1]!.x) > width * 1.7;
  return { center, hands, open };
}
export class UpperBodyTracker {
  private nextId = 0;
  swimmers: Swimmer[] = [];
  accept(poses: Pose[], now: number) {
    this.swimmers = this.swimmers.filter((s) => now - s.seen < 1200);
    const available = new Set(this.swimmers);
    const bodies = poses
      .map(upperBody)
      .filter((b) => b !== undefined)
      .sort((a, b) => a.center.x - b.center.x);
    for (const body of bodies) {
      let nearest: Swimmer | undefined,
        distance = 0.22;
      for (const s of available) {
        const d = Math.hypot(
          s.center.x - body.center.x,
          s.center.y - body.center.y,
        );
        if (d < distance) {
          nearest = s;
          distance = d;
        }
      }
      if (nearest) {
        available.delete(nearest);
        nearest.center = mix(nearest.center, body.center);
        nearest.hands = body.hands.map((p, i) =>
          p && nearest!.hands[i] ? mix(nearest!.hands[i]!, p) : p,
        );
        nearest.open = body.open;
        nearest.seen = now;
      } else this.swimmers.push({ ...body, id: this.nextId++, seen: now });
    }
  }
  visible(now: number) {
    return this.swimmers.filter((s) => now - s.seen < 1200);
  }
  clear() {
    this.swimmers = [];
  }
}
