import { LAYOUT } from "../data.ts";
import { PlayStatus, type GameState } from "../types.ts";

export class Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number; // Store the original speed
  radius: number;
  color: string;
  private gameState: GameState;

  private defaultRadius = 0.015;

  constructor(gameState: GameState, startX: number, startY: number) {
    this.gameState = gameState;
    this.x = startX;
    this.y = startY;
    this.radius = this.defaultRadius;
    this.color = "red";

    // Initial speed
    this.speed = this.gameState.ballSpeed || 0.015;
    this.dx = this.speed;
    this.dy = -this.speed;
  }

  draw() {
    const ctx = this.gameState.ctx;
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(
      this.x * ctx.canvas.width,
      this.y * ctx.canvas.height,
      this.radius * ctx.canvas.width,
      Math.PI * 2,
      0,
    );
    ctx.fill();
  }

  update() {
    // 1. Status Effects
    const isTiny = this.gameState.activeStatuses.some(
      (s) => s.type === PlayStatus.REDUCED_BALL_SIZE,
    );
    const isFast = this.gameState.activeStatuses.some(
      (s) => s.type === PlayStatus.INCREASED_SPEED,
    );
    const isSlow = this.gameState.activeStatuses.some(
      (s) => s.type === PlayStatus.REDUCED_SPEED,
    );
    const isFireBall = this.gameState.activeStatuses.some(
      (s) => s.type === PlayStatus.FIRE_BALL,
    );

    // Size
    this.radius = isTiny ? 0.008 : this.defaultRadius;
    this.color = isFireBall ? "orange" : "red";

    // Speed Multiplier
    let speedMult = 1;
    if (isFast) speedMult = 1.5;
    if (isSlow) speedMult = 0.6;

    // Apply movement with multiplier
    // Note: We don't change dx/dy permanently, just the movement step
    this.x += this.dx * speedMult;
    this.y += this.dy * speedMult;

    // Wall Collisions
    if (this.x - this.radius < 0 || this.x + this.radius > 1) {
      this.dx *= -1;
      this.x = this.x < 0.5 ? this.radius : 1 - this.radius;
    }

    // Ceiling Collision
    if (this.y - this.radius <= LAYOUT.marginTop) {
      this.dy *= -1;
      this.y = LAYOUT.marginTop + this.radius;
    }

    // Floor Collision
    if (this.y - this.radius > 1) {
      const ballIndex = this.gameState.ballArray.indexOf(this);
      if (ballIndex > -1) {
        this.gameState.ballArray.splice(ballIndex, 1);
      }
    }
  }
}
