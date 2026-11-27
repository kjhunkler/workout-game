import { clearsObstacle } from "./motion";
import type { GameDefinition, Motion, Obstacle, Player } from "./types";
export class Run {
  elapsed = 0;
  obstacles: Obstacle[] = [];
  scores: number[];
  streaks: number[];
  feedback: { text: string; until: number }[];
  private nextAt = 5;
  private nextId = 0;
  finished = false;
  onClear?: () => void;
  constructor(
    public definition: GameDefinition,
    public players: Player[],
  ) {
    this.scores = players.map(() => 0);
    this.streaks = players.map(() => 0);
    this.feedback = players.map(() => ({ text: "", until: 0 }));
  }
  update(delta: number, motions: Motion[]) {
    if (this.finished) return;
    this.elapsed = Math.min(this.definition.duration, this.elapsed + delta);
    if (
      this.elapsed + this.definition.speed >= this.nextAt &&
      this.nextAt < this.definition.duration - 1
    ) {
      const kinds = ["jump", "duck", "dodge"] as const;
      this.obstacles.push({
        id: this.nextId,
        kind: kinds[this.nextId % 3],
        side: this.nextId % 2 ? -1 : 1,
        at: this.nextAt,
        resolved: false,
      });
      this.nextId++;
      this.nextAt += this.definition.interval;
    }
    for (const obstacle of this.obstacles) {
      if (obstacle.resolved || this.elapsed < obstacle.at) continue;
      obstacle.resolved = true;
      motions.forEach((motion, index) => {
        const clear = clearsObstacle(obstacle.kind, obstacle.side, motion);
        this.scores[index] += clear ? 100 : 0;
        this.streaks[index] = clear ? this.streaks[index] + 1 : 0;
        this.feedback[index] = {
          text: clear ? "+100 · Nice move!" : "Keep going!",
          until: this.elapsed + 1.6,
        };
        if (clear) this.onClear?.();
      });
    }
    this.obstacles = this.obstacles.filter(
      (obstacle) => this.elapsed - obstacle.at < 1,
    );
    this.finished = this.elapsed >= this.definition.duration;
  }
  get upcoming() {
    return this.obstacles.find((obstacle) => !obstacle.resolved);
  }
}
