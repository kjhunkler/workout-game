import { test } from "node:test";
import assert from "node:assert/strict";
import { interpret, matchPoses, measure, clearsObstacle } from "../src/motion";
import { Run } from "../src/game";
import { GAMES, type Pose } from "../src/types";
function pose(x = 0.5): Pose {
  const points = Array.from({ length: 33 }, () => ({
    x,
    y: 0.2,
    visibility: 0.99,
  }));
  for (const i of [11, 12]) points[i].y = 0.35;
  for (const i of [23, 24]) points[i].y = 0.55;
  for (const i of [27, 28]) points[i].y = 0.9;
  return points;
}
test("standing, jumping, ducking, and mirrored sidesteps use personal calibration", () => {
  const standing = pose(),
    baseline = measure(standing);
  assert.equal(interpret(standing, baseline).action, "run");
  const jumping = standing.map((p) => ({ ...p, y: p.y - 0.08 }));
  assert.equal(interpret(jumping, baseline).action, "jump");
  const ducking = standing.map((p) => ({ ...p, y: p.y + 0.1 }));
  assert.equal(interpret(ducking, baseline).action, "duck");
  assert.equal(interpret(pose(0.6), baseline).action, "left");
  assert.equal(interpret(pose(0.4), baseline).action, "right");
  const kneeLift = pose();
  kneeLift[27].y -= 0.1;
  assert.equal(interpret(kneeLift, baseline).action, "run");
  const hidden = pose();
  hidden[27].visibility = 0.1;
  assert.equal(interpret(hidden, baseline).tracked, false);
});
test("detector order changes and missing people preserve player slots", () => {
  const left = pose(0.75),
    right = pose(0.25),
    anchors = [measure(left), measure(right)];
  assert.deepEqual(matchPoses(anchors, [right, left]), [left, right]);
  assert.deepEqual(matchPoses(anchors, [right]), [undefined, right]);
  assert.deepEqual(matchPoses(anchors, []), [undefined, undefined]);
});
test("a dodge clears only by moving away from the blocked side", () => {
  assert.equal(
    clearsObstacle("dodge", -1, { action: "right", lean: 1, tracked: true }),
    true,
  );
  assert.equal(
    clearsObstacle("dodge", -1, { action: "left", lean: -1, tracked: true }),
    false,
  );
  assert.equal(
    clearsObstacle("jump", 1, { action: "jump", lean: 0, tracked: false }),
    false,
  );
});
test("rounds score each player once per obstacle and finish at one minute", () => {
  const game = new Run(GAMES[0], [
    { id: "a", name: "Avery", color: "blue", active: true },
    { id: "c", name: "Cameron", color: "green", active: true },
  ]);
  game.update(0.6, [
    { action: "run", lean: 0, tracked: true },
    { action: "run", lean: 0, tracked: true },
  ]);
  assert.equal(game.upcoming?.kind, "jump");
  game.update(4.4, [
    { action: "jump", lean: 0, tracked: true },
    { action: "run", lean: 0, tracked: true },
  ]);
  assert.deepEqual(game.scores, [100, 0]);
  game.update(0.1, [
    { action: "jump", lean: 0, tracked: true },
    { action: "jump", lean: 0, tracked: true },
  ]);
  assert.deepEqual(game.scores, [100, 0]);
  for (let i = 0; i < 600; i++)
    game.update(0.1, [
      { action: "run", lean: 0, tracked: true },
      { action: "run", lean: 0, tracked: true },
    ]);
  assert.equal(game.finished, true);
  assert.equal(game.elapsed, 60);
});
