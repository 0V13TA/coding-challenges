import { type GameState } from "../types";

export class Shooter {
  x: number;
  y: number;
  dx: number;
  width: number;
  height: number;
  private gameState: GameState;
  private readonly color: string;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(gameState: GameState, startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
    this.width = 0.02;
    this.height = 0.3;
    this.color = "#ff0000";
    this.gameState = gameState;
    this.ctx = this.gameState.ctx;
  }

  draw() {
    this.ctx.beginPath();
    this.ctx.fillStyle = this.color;
    this.gameState.ctx.strokeStyle = "black";
    this.gameState.ctx.rect(
      this.x * this.ctx.canvas.width,
      this.y * this.ctx.canvas.height,
      this.width * this.ctx.canvas.width,
      this.height * this.ctx.canvas.height,
    );
    this.ctx.fill();
    this.ctx.stroke();
  }
}
