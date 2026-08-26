import { BlockType, type GameState, PlayStatus } from "../types";

export class Block {
  x: number;
  y: number;
  dx: number;
  color: string;
  width: number;
  height: number;
  private gameState: GameState;
  private ctx: CanvasRenderingContext2D;
  hp: number; // Add Health
  maxHp: number; // To calculate color intensity
  readonly type: BlockType;
  readonly content: PlayStatus | null;

  constructor(
    startX: number,
    startY: number,
    width: number,
    height: number,
    type: BlockType,
    gameState: GameState,
    hasContent: boolean = false,
  ) {
    this.x = startX;
    this.y = startY;
    this.width = width;
    this.height = height;
    this.type = type;
    this.gameState = gameState;
    this.ctx = this.gameState.ctx;
    this.color = "brown";
    this.content = null;

    // SETUP HEALTH
    switch (type) {
      case BlockType.STRONG:
        this.hp = 3; // Takes 3 hits
        this.color = "gold";
        break;
      case BlockType.INDESTRUCTIBLE:
        this.hp = Infinity;
        this.color = "gray";
        break;
      case BlockType.DROP:
      case BlockType.NORMAL:
      default:
        this.hp = 1;
        this.color = type === BlockType.DROP ? "purple" : "blue"; // Distinct colors
        break;
    }
    this.maxHp = this.hp;

    if (type === BlockType.INDESTRUCTIBLE) {
      this.color = "steelblue";
    }

    if (type !== BlockType.DROP && hasContent) {
      throw new Error(
        `hasContent Can't Be true when type is not BlockType.Drop. type is currently ${this.type}`,
      );
    }

    if (hasContent) {
      const contents = [
        PlayStatus.BOMB,
        PlayStatus.SHOOTER,
        PlayStatus.FIRE_BALL,
        PlayStatus.GHOST_PADDLE,
        PlayStatus.EXTRA_HEALTH,
        PlayStatus.REDUCED_SPEED,
        PlayStatus.LONGER_PADDLE,
        PlayStatus.INCREASED_SPEED,
        PlayStatus.DUPLICATE_PADDLE,
        PlayStatus.INVERTED_CONTROLS,
        PlayStatus.REDUCED_BALL_SIZE,
        PlayStatus.REDUCED_PADDLE_SIZE,
      ];

      const index = Math.floor(Math.random() * contents.length);
      this.content = contents[index];
    } else {
      this.content = null;
    }
  }

  draw() {
    this.ctx.beginPath();
    // VISUAL DAMAGE: Fade color as HP drops
    if (this.type === BlockType.STRONG) {
      const opacity = this.hp / this.maxHp;
      this.ctx.globalAlpha = opacity; // Fade out
      this.ctx.fillStyle = this.color;
    } else {
      this.ctx.fillStyle = this.color;
    }
    this.gameState.ctx.rect(
      this.x * this.ctx.canvas.width,
      this.y * this.ctx.canvas.height,
      this.width * this.ctx.canvas.width,
      this.height * this.ctx.canvas.height,
    );
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.globalAlpha = 1.0;
  }
}
