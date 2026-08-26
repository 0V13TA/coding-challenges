import { GameState } from "../types";

export class Bomb {
  x: number;
  y: number;
  readonly radius: number;
  private gameState: GameState;
  private readonly color: string;
  private readonly stroke: string;
  private ctx: CanvasRenderingContext2D;

  constructor(gameState: GameState, startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
    this.radius = 0.3;
    this.color = "#000000";
    this.stroke = "#a3a3a3";
    this.gameState = gameState;
    this.ctx = this.gameState.ctx;
  }

  draw() {
    this.ctx.beginPath();
    this.ctx.fillStyle = this.color;
    this.ctx.strokeStyle = this.stroke;
    this.ctx.arc(
      this.x,
      this.y,
      this.radius * this.ctx.canvas.width,
      Math.PI * 2,
      0,
    );
    this.ctx.fill();
    this.ctx.stroke();
  }
}
