import { PlayStatus, type GameState } from "../types";

export class UniqueStatusDrop {
  private readonly dy: number;
  private readonly color: string;
  private readonly gameState: GameState;
  private readonly ctx: CanvasRenderingContext2D;

  y: number;
  radius: number;
  readonly x: number;
  dropType: PlayStatus;

  constructor(
    startX: number,
    startY: number,
    dropType: PlayStatus,
    gameState: GameState,
  ) {
    this.x = startX;
    this.y = startY;
    this.dropType = dropType;
    this.gameState = gameState;
    this.ctx = this.gameState.ctx;
    this.dy = 0.005;
    this.radius = this.gameState.ballSize;

    switch (dropType) {
      // --- GOOD STUFF ---
      case PlayStatus.EXTRA_HEALTH:
        this.color = "#ff1493"; // Deep Pink (Heart)
        break;
      case PlayStatus.LONGER_PADDLE:
        this.color = "#32cd32"; // Lime Green (Growth)
        break;
      case PlayStatus.FIRE_BALL:
        this.color = "#ff4500"; // Orange Red (Fire)
        break;
      case PlayStatus.SHOOTER:
        this.color = "#ffd700"; // Gold (Weapon)
        break;

      // --- NEUTRAL / MIXED ---
      case PlayStatus.GHOST_PADDLE:
        this.color = "rgba(255, 255, 255, 0.5)"; // Ghostly White
        break;
      case PlayStatus.DUPLICATE_PADDLE:
        this.color = "#00ffff"; // Cyan
        break;

      // --- BAD / TRICKY STUFF ---
      case PlayStatus.BOMB:
        this.color = "#2f4f4f"; // Dark Slate Grey
        break;
      case PlayStatus.REDUCED_PADDLE_SIZE:
        this.color = "#8b0000"; // Dark Red (Shrink)
        break;
      case PlayStatus.INVERTED_CONTROLS:
        this.color = "#800080"; // Purple (Confusion)
        break;
      case PlayStatus.REDUCED_BALL_SIZE:
        this.color = "#778899"; // Light Slate Grey (Tiny)
        break;
      case PlayStatus.INCREASED_SPEED:
        this.color = "#ff8c00"; // Dark Orange (Fast)
        break;
      case PlayStatus.REDUCED_SPEED:
        this.color = "#00bfff"; // Deep Sky Blue (Ice/Slow)
        break;

      default:
        this.color = "white";
    }
  }

  draw() {
    this.ctx.beginPath();
    this.ctx.fillStyle = this.color;
    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = 2;
    this.ctx.arc(
      this.x * this.ctx.canvas.width,
      this.y * this.ctx.canvas.height,
      this.radius * this.ctx.canvas.width,
      Math.PI * 2,
      0,
    );
    this.ctx.fill();
    this.ctx.stroke();
  }

  update() {
    this.y += this.dy;

    if (this.y >= 1) {
      const uniqueBallIndex = this.gameState.uniqueDropArray.findIndex((val) =>
        val === this ? true : false,
      );

      this.gameState.uniqueDropArray.splice(uniqueBallIndex, 1);
    }
  }
}
