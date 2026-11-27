export type Action = "run" | "jump" | "duck" | "left" | "right";
export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};
export type Pose = Landmark[];
export type Player = {
  id: string;
  name: string;
  color: string;
  active: boolean;
};
export type Motion = {
  action: Action;
  lean: number;
  joints?: Pose;
  tracked: boolean;
};
export type Baseline = {
  x: number;
  hipY: number;
  shoulderY: number;
  ankleY: number;
  torso: number;
};
export type Obstacle = {
  id: number;
  kind: "jump" | "duck" | "dodge";
  side: -1 | 1;
  at: number;
  resolved: boolean;
};
export type GameDefinition = {
  id: string;
  title: string;
  duration: number;
  speed: number;
  interval: number;
};
export const GAMES: GameDefinition[] = [
  {
    id: "trail-dash",
    title: "Trail Dash",
    duration: 60,
    speed: 4.5,
    interval: 4.2,
  },
];
