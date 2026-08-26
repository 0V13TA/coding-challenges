import { type GameState } from "../types";

export function update() {}

export function draw(gameState: GameState) {
  const ctx = gameState.ctx;
  const canvas = ctx.canvas;
  ctx.save();

  // Semi-transparent background
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // "PAUSED" Text
  ctx.fillStyle = "white";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);

  // Subtext
  ctx.font = "16px Arial";
  ctx.fillText("Press P to Resume", canvas.width / 2, canvas.height / 2 + 50);

  ctx.restore();
}
