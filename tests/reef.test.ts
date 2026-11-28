import { test } from "node:test";
import assert from "node:assert/strict";
import { UpperBodyTracker, upperBody } from "../src/upper-body";
import { ReefGame, segmentDistance, type Feelers } from "../src/reef-game";
import type { Pose } from "../src/types";
function pose(x = 0.5): Pose {
  const p: Pose = [];
  p[11] = { x: x - 0.06, y: 0.4, visibility: 1 };
  p[12] = { x: x + 0.06, y: 0.4, visibility: 1 };
  p[15] = { x: x - 0.2, y: 0.4, visibility: 1 };
  p[16] = { x: x + 0.2, y: 0.4, visibility: 1 };
  return p;
}
const hand = (x: number, y: number): Feelers => ({
  key: "a",
  point: { x, y },
  current: false,
  color: "#ffffff",
});
test("upper-body controls work without legs; hidden wrists cannot activate a current", () => {
  assert.equal(upperBody(pose())?.open, true);
  const p = pose();
  p[15].visibility = 0.1;
  assert.equal(upperBody(p)?.open, false);
  assert.equal(upperBody(p)?.hands[0], undefined);
  p[11].visibility = 0.1;
  assert.equal(upperBody(p), undefined);
});
test("reordered detections keep identity and missing people expire without stopping others", () => {
  const tracker = new UpperBodyTracker();
  tracker.accept([pose(0.25), pose(0.75)], 0);
  const first = tracker.swimmers.map((s) => ({ id: s.id, x: s.center.x }));
  tracker.accept([pose(0.75), pose(0.25)], 100);
  assert.deepEqual(
    tracker.swimmers.map((s) => ({ id: s.id, x: s.center.x })),
    first,
  );
  tracker.accept([pose(0.25)], 500);
  assert.equal(tracker.visible(1300).length, 1);
  tracker.accept([pose(0.75), pose(0.25)], 1400);
  assert.equal(tracker.visible(1400).length, 2);
  tracker.clear();
  assert.equal(tracker.visible(1400).length, 0);
});
test("swept contact is forgiving, and duplicate hands collect a pearl only once", () => {
  assert.equal(
    segmentDistance({ x: 0.5, y: 0.5 }, { x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 }),
    0,
  );
  const g = new ReefGame(() => 0.5);
  g.pearls = [{ id: 1, x: 0.5, y: 0.5, phase: 0 }];
  g.update(0, [hand(0.42, 0.5)], 1);
  assert.equal(g.collected, 0);
  g.pearls = [{ id: 1, x: 0.5, y: 0.5, phase: 0 }];
  g.update(0, [hand(0.58, 0.5), { ...hand(0.5, 0.5), key: "b" }], 1);
  assert.equal(g.collected, 1);
});
test("dropout clears sweeping history and no phantom contact occurs on return", () => {
  const g = new ReefGame(() => 0.5);
  g.pearls = [{ id: 1, x: 0.5, y: 0.5, phase: 0 }];
  g.update(0, [hand(0.42, 0.5)], 1);
  g.update(0, [], 1);
  g.update(0, [hand(0.58, 0.5)], 1);
  assert.equal(g.collected, 0);
});
test("open arms attract nearby pearls, with a bounded reach", () => {
  const g = new ReefGame(() => 0.5);
  g.pearls = [
    { id: 1, x: 0.35, y: 0.5, phase: 0 },
    { id: 2, x: 0.9, y: 0.5, phase: 0 },
  ];
  g.update(0.08, [{ ...hand(0.5, 0.5), current: true }], 1);
  assert.ok(g.pearls[0].x > 0.36);
  assert.ok(g.pearls[1].x > 0.89);
  assert.equal(g.collected, 0);
});
test("shared goal celebrates once, does not score during celebration, and starts another reef", () => {
  const g = new ReefGame(() => 0.5);
  for (let i = 0; i < 24; i++) {
    g.pearls = [{ id: i, x: 0.5, y: 0.5, phase: 0 }];
    g.update(0, [hand(0.5, 0.5)], 1);
  }
  assert.equal(g.collected, 24);
  assert.equal(g.celebration, 8);
  g.update(0.08, [hand(0.5, 0.5)], 1);
  assert.equal(g.collected, 24);
  for (let i = 0; i < 101; i++) g.update(0.08, [], 1);
  assert.equal(g.collected, 0);
  assert.equal(g.cycle, 1);
  assert.equal(g.pearls.length, 14);
});
