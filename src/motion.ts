import type { Baseline, Motion, Pose } from "./types";
const midpoint = (pose: Pose, a: number, b: number, key: "x" | "y") =>
  (pose[a][key] + pose[b][key]) / 2;
export function isVisible(pose: Pose): boolean {
  return (
    pose.length >= 33 &&
    [11, 12, 23, 24, 27, 28].every(
      (index) => (pose[index].visibility ?? 0) > 0.45,
    )
  );
}
export function measure(pose: Pose): Baseline {
  const shoulderY = midpoint(pose, 11, 12, "y");
  const hipY = midpoint(pose, 23, 24, "y");
  return {
    x: 1 - midpoint(pose, 23, 24, "x"),
    hipY,
    shoulderY,
    ankleY: midpoint(pose, 27, 28, "y"),
    torso: Math.max(0.06, hipY - shoulderY),
  };
}
export function interpret(pose: Pose, baseline: Baseline): Motion {
  if (!isVisible(pose)) return { action: "run", lean: 0, tracked: false };
  const current = measure(pose);
  const lean = Math.max(
    -1,
    Math.min(1, (current.x - baseline.x) / (baseline.torso * 0.65)),
  );
  let action: Motion["action"] = "run";
  if (
    baseline.hipY - current.hipY > baseline.torso * 0.22 &&
    baseline.ankleY - current.ankleY > baseline.torso * 0.12
  )
    action = "jump";
  else if (current.shoulderY - baseline.shoulderY > baseline.torso * 0.36)
    action = "duck";
  else if (lean < -0.45) action = "left";
  else if (lean > 0.45) action = "right";
  return { action, lean, joints: pose, tracked: true };
}
// Globally match detections to the last known player positions. A missing person
// leaves a vacant slot, so the detector's changing array order cannot swap colors.
export function matchPoses(
  anchors: Baseline[],
  poses: Pose[],
): (Pose | undefined)[] {
  const candidates = poses.filter(isVisible);
  let bestCost = Infinity;
  let best: (Pose | undefined)[] = anchors.map(() => undefined);
  function visit(
    index: number,
    used: Set<number>,
    selection: (Pose | undefined)[],
    cost: number,
  ) {
    if (cost >= bestCost) return;
    if (index === anchors.length) {
      bestCost = cost;
      best = [...selection];
      return;
    }
    const anchor = anchors[index];
    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue;
      const point = measure(candidates[i]);
      const distance = Math.hypot(point.x - anchor.x, point.hipY - anchor.hipY);
      if (distance > 0.28) continue;
      used.add(i);
      visit(index + 1, used, [...selection, candidates[i]], cost + distance);
      used.delete(i);
    }
    visit(index + 1, used, [...selection, undefined], cost + 0.3);
  }
  visit(0, new Set(), [], 0);
  return best;
}
export function clearsObstacle(
  kind: "jump" | "duck" | "dodge",
  side: -1 | 1,
  motion: Motion,
) {
  if (!motion.tracked) return false;
  if (kind === "dodge")
    return side === -1 ? motion.action === "right" : motion.action === "left";
  return motion.action === kind;
}
