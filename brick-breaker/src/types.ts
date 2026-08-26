import { Ball } from "./objects/ball.ts";
import { Block } from "./objects/block.ts";
import { Shooter } from "./objects/shooter.ts";
import { UniqueStatusDrop } from "./objects/uniqueStatus";

export enum GameScreen {
  PAUSE_SCREEN,
  GAME_PLAY,
  GAME_OVER,
}

export enum PlayStatus {
  BOMB,
  SHOOTER,
  FIRE_BALL,
  GHOST_PADDLE,
  EXTRA_HEALTH,
  REDUCED_SPEED,
  LONGER_PADDLE,
  INCREASED_SPEED,
  DUPLICATE_PADDLE,
  INVERTED_CONTROLS,
  REDUCED_BALL_SIZE,
  REDUCED_PADDLE_SIZE,
}

export type ActiveStatus = {
  type: PlayStatus;
  duration: number;
};

export enum BlockType {
  DROP,
  STRONG,
  NORMAL,
  INDESTRUCTIBLE,
}

type Volume = {
  music: number;
  effects: number;
  general: number;
};

export type GameState = {
  life: number;
  volume: Volume;
  ballSize: number;
  bombCount: number;
  dropSpeed: number;
  ballSpeed: number;
  ghostDrawn: boolean;
  paddleSpeed: number;
  gameScreen: GameScreen;
  ctx: CanvasRenderingContext2D;

  ballArray: Ball[];
  blockArray: Block[];
  shooterArray: Shooter[];
  activeStatuses: ActiveStatus[];
  uniqueDropArray: UniqueStatusDrop[];
};

export const StatusNames: Record<PlayStatus, string> = {
  [PlayStatus.BOMB]: "Bomb",
  [PlayStatus.SHOOTER]: "Shooter",
  [PlayStatus.FIRE_BALL]: "Fire Ball",
  [PlayStatus.GHOST_PADDLE]: "Ghost",
  [PlayStatus.EXTRA_HEALTH]: "Heart +1",
  [PlayStatus.REDUCED_SPEED]: "Slow Mo",
  [PlayStatus.LONGER_PADDLE]: "Wide Paddle",
  [PlayStatus.INCREASED_SPEED]: "Fast Forward",
  [PlayStatus.DUPLICATE_PADDLE]: "Dual Paddle",
  [PlayStatus.INVERTED_CONTROLS]: "Inverted",
  [PlayStatus.REDUCED_BALL_SIZE]: "Tiny Ball",
  [PlayStatus.REDUCED_PADDLE_SIZE]: "Tiny Paddle",
};
