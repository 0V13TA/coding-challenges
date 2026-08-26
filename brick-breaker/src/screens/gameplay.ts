import { LAYOUT, level1 } from "../data.ts";
import { Ball } from "../objects/ball";
import { Block } from "../objects/block.ts";
import { Paddle } from "../objects/paddle";
import { UniqueStatusDrop } from "../objects/uniqueStatus.ts";
import {
  BlockType,
  GameScreen,
  PlayStatus,
  StatusNames,
  type GameState,
} from "../types";
import {
  checkCollisionCircleRec,
  getCollisionDirection,
  handlePaddleCollisionSKill,
} from "../utils.ts";

let paddle: Paddle;
let ghost: Paddle | null = null;
const keysPressed = new Set<string>();
// Flag to ensure we don't add listeners multiple times on restart
let inputListenersAdded = false;

function handleInput(clientX: number) {
  // 1. Clear existing directions so we don't get stuck
  clearInput();

  // 2. Check which side of the screen was touched
  if (clientX < window.innerWidth / 2) {
    keysPressed.add("ArrowLeft");
  } else {
    keysPressed.add("ArrowRight");
  }
}

function clearInput() {
  keysPressed.delete("ArrowLeft");
  keysPressed.delete("ArrowRight");
}

export function init(gameState: GameState) {
  paddle = new Paddle(gameState);
  gameState.ballArray = [];
  gameState.activeStatuses = [];

  if (gameState.ballArray.length === 0) {
    const newBall = new Ball(
      gameState,
      paddle.x + paddle.width / 2,
      paddle.y - 0.02,
    );
    gameState.ballArray.push(newBall);
  }

  gameState.blockArray = [];
  createLevel(gameState);

  // --- INPUT HANDLING ---
  if (!inputListenersAdded) {
    inputListenersAdded = true;

    // 1. Keyboard (Existing)
    window.addEventListener("keydown", (e) => keysPressed.add(e.key));
    window.addEventListener("keyup", (e) => keysPressed.delete(e.key));

    // 2. Touch (Mobile)
    window.addEventListener("touchstart", (e) => {
      handleInput(e.touches[0].clientX);
    });
    window.addEventListener(
      "touchmove",
      (e) => {
        // Prevent scrolling while playing
        e.preventDefault();
        handleInput(e.touches[0].clientX);
      },
      { passive: false },
    );
    window.addEventListener("touchend", clearInput);

    // 3. Mouse (Click)
    window.addEventListener("mousedown", (e) => handleInput(e.clientX));
    window.addEventListener("mouseup", clearInput);
  }
}

function createLevel(gameState: GameState) {
  // Use the length of the first row to determine columns
  const numCols = level1[0].length;

  // 1. Calculate Available Width
  // Total width (1.0) minus Left Margin minus Right Margin
  const totalAvailableWidth = 1.0 - LAYOUT.marginLeft - LAYOUT.marginRight;

  // 2. Calculate Total Space taken by Gaps
  // If we have 10 columns, there are 9 gaps between them
  const totalGapWidth = (numCols - 1) * LAYOUT.gap;

  // 3. Calculate Single Block Width
  const blockWidth = (totalAvailableWidth - totalGapWidth) / numCols;

  level1.forEach((row, rowIndex) => {
    row.forEach((cellValue, colIndex) => {
      if (cellValue === 0) return;

      // 4. Calculate Position
      // Start at Margin + (BlockWidth * ColIndex) + (Gap * ColIndex)
      const x = LAYOUT.marginLeft + colIndex * (blockWidth + LAYOUT.gap);

      // Start at MarginTop + (BlockHeight * RowIndex) + (Gap * RowIndex) + Tiny Padding
      const y =
        LAYOUT.marginTop + rowIndex * (LAYOUT.rowHeight + LAYOUT.gap) + 0.01;

      let type = BlockType.NORMAL;
      let hasContent = false;

      if (cellValue === 2) {
        type = BlockType.DROP;
        hasContent = true;
      } else if (cellValue === 4) {
        type = BlockType.INDESTRUCTIBLE;
      } else if (cellValue === 3) {
        type = BlockType.STRONG;
      }

      const block = new Block(
        x,
        y,
        blockWidth,
        LAYOUT.rowHeight,
        type,
        gameState,
        hasContent,
      );

      gameState.blockArray.push(block);
    });
  });
}

function resetTurn(gameState: GameState) {
  // 1. Reset Paddle Position
  paddle = new Paddle(gameState);

  // 2. Spawn a New Ball at the paddle
  gameState.ballArray = [];
  const newBall = new Ball(
    gameState,
    paddle.x + paddle.width / 2,
    paddle.y - 0.05, // Place slightly above paddle
  );

  // Ensure the new ball has the correct speed
  newBall.dx = gameState.ballSpeed;
  newBall.dy = -gameState.ballSpeed;

  gameState.ballArray.push(newBall);
}

export function update(gameState: GameState) {
  // filter out the statuses that has ended
  gameState.activeStatuses = gameState.activeStatuses.filter((status) => {
    status.duration--; // Decrease time by 1 frame
    return status.duration > 0;
  });

  const isGhostActive = gameState.activeStatuses.findIndex(
    (val) => val.type === PlayStatus.GHOST_PADDLE,
  );

  paddle.update(keysPressed);

  if (!gameState.ghostDrawn && isGhostActive > -1) {
    ghost = new Paddle(gameState, true);
    ghost.update(keysPressed);
  } else if (isGhostActive < 0) {
    ghost = null;
  }

  gameState.ballArray.forEach((ball) => {
    // ... movement logic ...

    // Wall Collisions
    if (ball.x <= 0 || ball.x >= 1) ball.dx *= -1;
    if (ball.y <= 0) ball.dy *= -1;

    // Paddle Collision
    if (checkCollisionCircleRec(paddle, ball)) {
      handlePaddleCollisionSKill(ball, paddle);
    }

    ball.update();

    // Iterate BACKWARDS so we can safely remove items
    for (let index = gameState.blockArray.length - 1; index >= 0; index--) {
      const block = gameState.blockArray[index];
      const collisionDir = getCollisionDirection(ball, block);
      if (collisionDir) {
        const isFireBall = gameState.activeStatuses.some(
          (s) => s.type === PlayStatus.FIRE_BALL,
        );

        // 1. Handle Bounce
        // Fireball DOES NOT bounce (passes through), unless it hits Indestructible
        if (!isFireBall || block.type === BlockType.INDESTRUCTIBLE) {
          if (collisionDir === "horizontal") {
            ball.dx *= -1;
          } else {
            ball.dy *= -1;
          }
        }

        // 2. Handle Damage
        if (block.type !== BlockType.INDESTRUCTIBLE) {
          if (isFireBall) {
            block.hp = 0; // INSTA-KILL
          } else {
            block.hp--; // Normal Damage
          }

          // 3. Destroy if dead
          if (block.hp <= 0) {
            gameState.blockArray.splice(index, 1);

            // Spawn Drop logic...
            if (block.type === BlockType.DROP && block.content !== null) {
              // ... spawn drop code ...
              const drop = new UniqueStatusDrop(
                block.x + block.width / 2,
                block.y,
                block.content,
                gameState,
              );
              gameState.uniqueDropArray.push(drop);
            }
          }
        } else if (isFireBall) {
          gameState.blockArray.splice(index, 1);
        }

        const blocks = gameState.blockArray.filter(
          (block) => block.type !== BlockType.INDESTRUCTIBLE,
        );

        if (blocks.length === 0) {
          gameState.gameScreen = GameScreen.GAME_OVER;
        }
      }
    }

    if (gameState.ballArray.length === 0) {
      gameState.life--; // Lose a life

      if (gameState.life > 0) {
        resetTurn(gameState); // Reset just the ball/paddle
      } else {
        gameState.gameScreen = GameScreen.GAME_OVER; // Game Over
      }
    }
  });

  // 2. PADDLE VS DROP (Collecting Power-ups)
  gameState.uniqueDropArray.forEach((drop, index) => {
    drop.update();

    // Check collision with paddle
    if (checkCollisionCircleRec(paddle, drop)) {
      // Remove drop
      gameState.uniqueDropArray.splice(index, 1);

      const existingStatus = gameState.activeStatuses.find(
        (s) => s.type === drop.dropType,
      );

      if (existingStatus) existingStatus.duration = 600;
      else {
        // Activate Status
        gameState.activeStatuses.push({
          type: drop.dropType,
          duration: 600, // 10 seconds at 60fps
        });
      }
    }
  });
}

export function draw(gameState: GameState) {
  const ctx = gameState.ctx;
  const isGhostActive = gameState.activeStatuses.findIndex(
    (val) => val.type === PlayStatus.GHOST_PADDLE,
  );

  paddle.draw();
  if (isGhostActive > -1 && !gameState.ghostDrawn) {
    gameState.ghostDrawn = true;
    paddle.draw();
  }

  gameState.ballArray.forEach((ball) => ball.draw());
  gameState.blockArray.forEach((block) => block.draw());
  gameState.uniqueDropArray.forEach((drop) => drop.draw());

  drawUI(ctx, gameState);
}

function drawUI(ctx: CanvasRenderingContext2D, gameState: GameState) {
  // Draw the Background Bar for the UI
  ctx.save();
  ctx.fillStyle = "#222"; // Dark gray background for status bar
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height * LAYOUT.marginTop);

  // Add a separator line
  ctx.beginPath();
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.moveTo(0, ctx.canvas.height * LAYOUT.marginTop);
  ctx.lineTo(ctx.canvas.width, ctx.canvas.height * LAYOUT.marginTop);
  ctx.stroke();

  // Text Settings
  const padding = 20;
  ctx.font = "bold 20px Arial";
  ctx.textBaseline = "middle";
  const barCenterY = (ctx.canvas.height * LAYOUT.marginTop) / 2;

  // -- LEFT: Lives --
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.fillText(`Lives: ${gameState.life}`, padding, barCenterY);

  // -- CENTER: Level / Info -- (Optional)
  ctx.textAlign = "center";
  ctx.fillStyle = "#aaa";
  ctx.fillText("LEVEL 1", ctx.canvas.width / 2, barCenterY);

  // -- RIGHT: Active Statuses --
  // We draw them as small colorful badges
  ctx.textAlign = "right";
  let currentX = ctx.canvas.width - padding;

  gameState.activeStatuses.forEach((status) => {
    const name = StatusNames[status.type] || "Unknown";
    const secondsLeft = Math.ceil(status.duration / 60);

    // Status Text
    ctx.fillStyle = "#00ff88";
    const text = `${name} (${secondsLeft}s)`;
    ctx.fillText(text, currentX, barCenterY);

    // Move X position to the left for the next item
    const textWidth = ctx.measureText(text).width;
    currentX -= textWidth + 20; // 20px spacing between items
  });

  ctx.restore();
}
