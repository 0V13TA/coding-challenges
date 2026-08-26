import { PlayStatus, type GameState } from "../types";

export class Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  private gameState: GameState;
  private ctx: CanvasRenderingContext2D;
  private readonly isGhost: boolean;

  private defaultWidth = 0.2;

  constructor(gameState: GameState, isGhost: boolean = false) {
    this.x = 0.4;
    this.y = 0.93;
    this.width = this.defaultWidth;
    this.height = 0.03;
    this.color = "darkgreen";
    this.gameState = gameState;
    this.ctx = this.gameState.ctx;
    this.isGhost = isGhost;
  }

  draw() {
    this.ctx.beginPath();
    this.ctx.fillStyle = this.color;
    this.ctx.strokeStyle = "black";
    this.ctx.rect(
      this.x * this.ctx.canvas.width,
      this.y * this.ctx.canvas.height,
      this.width * this.ctx.canvas.width,
      this.height * this.ctx.canvas.height,
    );
    this.ctx.fill();
    this.ctx.stroke();
  }

  update(keysPressed: Set<string>) {
    // 1. Handle Active Status Effects on Paddle
    const isLong = this.gameState.activeStatuses.some(
      (s) => s.type === PlayStatus.LONGER_PADDLE,
    );
    const isShort = this.gameState.activeStatuses.some(
      (s) => s.type === PlayStatus.REDUCED_PADDLE_SIZE,
    );
    const isInverted = this.gameState.activeStatuses.some(
      (s) => s.type === PlayStatus.INVERTED_CONTROLS,
    );

    // Set Width
    if (isLong) this.width = 0.3;
    else if (isShort) this.width = 0.1;
    else this.width = this.defaultWidth;

    // Set Controls
    const leftKey = isInverted || this.isGhost ? "ArrowRight" : "ArrowLeft";
    const rightKey = isInverted || this.isGhost ? "ArrowLeft" : "ArrowRight";

    // 2. Movement Logic
    if (keysPressed.has(leftKey)) {
      this.x -= this.gameState.paddleSpeed;
    }
    if (keysPressed.has(rightKey)) {
      this.x += this.gameState.paddleSpeed;
    }

    // Boundary Checks
    if (this.x <= 0) this.x = 0;
    if (this.x + this.width >= 1) this.x = 1 - this.width;
  }
}
