"use strict";
//#region Init
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.createElement("p");
scoreEl.classList.add("score");
scoreEl.textContent = "Score: 0";

const MAP_WIDTH = 24;
const MAP_HEIGHT = 24;
const SCREEN_WIDTH = innerWidth; //648;
const SCREEN_HEIGHT = innerHeight; //480;
const BLOCK_WIDTH = SCREEN_WIDTH / MAP_WIDTH;
const BLOCK_HEIGHT = SCREEN_HEIGHT / MAP_HEIGHT;

canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

document.body.appendChild(canvas);
document.body.appendChild(scoreEl);

let score = 0;
let animationID;
let lastTime = 0;
let gameover = false;

const DEG2RAD = Math.PI / 180;
let worldMap = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 0, 0, 0, 3, 0, 3, 0, 3, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 2, 0, 2, 2, 0, 0, 0, 0, 3, 0, 3, 0, 3, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 4, 0, 4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 4, 0, 0, 0, 0, 5, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 4, 0, 4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 4, 0, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

worldMap = [
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7, 7, 7, 7, 7],
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 7],
  [4, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7],
  [4, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7],
  [4, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 7],
  [4, 0, 4, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 7, 7, 0, 7, 7, 7, 7, 7],
  [4, 0, 5, 0, 0, 0, 0, 5, 0, 5, 0, 5, 0, 5, 0, 5, 7, 0, 0, 0, 7, 7, 7, 1],
  [4, 0, 6, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 5, 7, 0, 0, 0, 0, 0, 0, 8],
  [4, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 1],
  [4, 0, 8, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 5, 7, 0, 0, 0, 0, 0, 0, 8],
  [4, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 5, 7, 0, 0, 0, 7, 7, 7, 1],
  [4, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 0, 5, 5, 5, 5, 7, 7, 7, 7, 7, 7, 7, 1],
  [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
  [6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 6, 0, 6, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3],
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 4, 6, 0, 6, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2],
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 2, 0, 0, 5, 0, 0, 2, 0, 0, 0, 2],
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 4, 6, 0, 6, 2, 0, 0, 0, 0, 0, 2, 2, 0, 2, 2],
  [4, 0, 6, 0, 6, 0, 0, 0, 0, 4, 6, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 2],
  [4, 0, 0, 5, 0, 0, 0, 0, 0, 4, 6, 0, 6, 2, 0, 0, 0, 0, 0, 2, 2, 0, 2, 2],
  [4, 0, 6, 0, 6, 0, 0, 0, 0, 4, 6, 0, 6, 2, 0, 0, 5, 0, 0, 2, 0, 0, 0, 2],
  [4, 0, 0, 0, 0, 0, 0, 0, 0, 4, 6, 0, 6, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3],
];
//
// worldMap = [
//   [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 6, 4, 4, 6, 4, 6, 4, 4, 4, 6, 4],
//   [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
//   [8, 0, 3, 3, 0, 0, 0, 0, 0, 8, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6],
//   [8, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6],
//   [8, 0, 3, 3, 0, 0, 0, 0, 0, 8, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4],
//   [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 4, 0, 0, 0, 0, 0, 6, 6, 6, 0, 6, 4, 6],
//   [8, 8, 8, 8, 0, 8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 6, 0, 0, 0, 0, 0, 6],
//   [7, 7, 7, 7, 0, 7, 7, 7, 7, 0, 8, 0, 8, 0, 8, 0, 8, 4, 0, 4, 0, 6, 0, 6],
//   [7, 7, 0, 0, 0, 0, 0, 0, 7, 8, 0, 8, 0, 8, 0, 8, 8, 6, 0, 0, 0, 0, 0, 6],
//   [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 6, 0, 0, 0, 0, 0, 4],
//   [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 6, 0, 6, 0, 6, 0, 6],
//   [7, 7, 0, 0, 0, 0, 0, 0, 7, 8, 0, 8, 0, 8, 0, 8, 8, 6, 4, 6, 0, 6, 6, 6],
//   [7, 7, 7, 7, 0, 7, 7, 7, 7, 8, 8, 4, 0, 6, 8, 4, 8, 3, 3, 3, 0, 3, 3, 3],
//   [2, 2, 2, 2, 0, 2, 2, 2, 2, 4, 6, 4, 0, 0, 6, 0, 6, 3, 0, 0, 0, 0, 0, 3],
//   [2, 2, 0, 0, 0, 0, 0, 2, 2, 4, 0, 0, 0, 0, 0, 0, 4, 3, 0, 0, 0, 0, 0, 3],
//   [2, 0, 0, 0, 0, 0, 0, 0, 2, 4, 0, 0, 0, 0, 0, 0, 4, 3, 0, 0, 0, 0, 0, 3],
//   [1, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 4, 4, 6, 0, 6, 3, 3, 0, 0, 0, 3, 3],
//   [2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 2, 2, 2, 6, 6, 0, 0, 5, 0, 5, 0, 5],
//   [2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 2, 2, 0, 5, 0, 5, 0, 0, 0, 5, 5],
//   [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 5, 0, 5, 0, 5, 0, 5, 0, 5],
//   [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
//   [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 5, 0, 5, 0, 5, 0, 5, 0, 5],
//   [2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 2, 2, 0, 5, 0, 5, 0, 0, 0, 5, 5],
//   [2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5],
// ];

// Color mapping for walls
const wallColors = {
  1: "#8B4513", // Brown
  2: "#A0522D", // Sienna
  3: "#CD853F", // Peru
  4: "#D2691E", // Chocolate
  5: "#B22222", // Firebrick
  6: "#556B2F", // Dark Olive Green
  7: "#4A4A4A", // Dark Gray
  8: "#2F4F4F", // Dark Slate Gray
};

//#endregion

// --- Timer Manager ---
const TimerManager = {
  /** @type {timer[]} **/
  timers: [],
  /** @type {number} */
  counterId: 0,

  /**
   * @param {number} interval
   * @param {requestCallback} callback
   * @param {boolean} [repeat=true]
   */
  add(interval, callback, repeat = true) {
    const id = this.counterId++;
    this.timers.push({
      id,
      interval,
      callback,
      elapsed: 0,
      paused: false,
      repeat,
    });
    return id;
  },

  setInterval(interval, callback) {
    return this.add(interval, callback, true);
  },

  update(dt) {
    // Delta time converted to milliseconds inside loop update
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if (t.paused) continue;

      t.elapsed += dt;
      if (t.elapsed >= t.interval) {
        t.callback();
        if (t.repeat) {
          t.elapsed -= t.interval;
        } else {
          this.timers.splice(i, 1);
        }
      }
    }
  },

  clearAll() {
    this.timers = [];
    this.counterId = 0;
  },
};

// --- Input Handling ---
const Input = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),

  init() {
    window.addEventListener("keydown", (e) => {
      // Prevent repeat spam
      if (!this.held.has(e.code)) {
        this.pressed.add(e.code);
      }

      this.held.add(e.code);
    });

    window.addEventListener("keyup", (e) => {
      this.held.delete(e.code);
      this.released.add(e.code);
    });
  },

  /**
   * @param {Keys} key
   */
  isHeld(key) {
    return this.held.has(key);
  },

  /**
   * @param {Keys} key
   */
  isPressed(key) {
    return this.pressed.has(key);
  },

  /**
   * @param {Keys} key
   */
  isReleased(key) {
    return this.released.has(key);
  },

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  },
};

// --- Collision Logic (Standard AABB) ---
function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * @param {number} centerX
 * @param {number} recX
 * @param {number} radius
 * @param {number} recY
 * @param {number} centerY
 * @param {number} recWidth
 * @param {number} recHeight
 */
function checkCollisionCircleRec(
  centerX,
  centerY,
  radius,
  recX,
  recY,
  recWidth,
  recHeight,
) {
  let collision = false;

  let recCenterX = recX + recWidth / 2;
  let recCenterY = recY + recHeight / 2;

  let dx = Math.abs(centerX - recCenterX);
  let dy = Math.abs(centerY - recCenterY);

  if (dx <= recWidth / 2 + radius && dy <= recHeight / 2 + radius) {
    if (dx <= recWidth / 2) collision = true;
    else if (dy <= recHeight / 2) collision = true;
    else {
      let cornerDistanceSq =
        (dx - recWidth / 2) * (dx - recWidth / 2) +
        (dy - recHeight / 2) * (dy - recHeight / 2);
      collision = cornerDistanceSq <= radius * radius;
    }
  }

  return collision;
}

class Player {
  constructor() {
    this.fov = 60;
    this.dir = 270; // angle player looking (DEG)
    this.radius = 5;
    this.speed = 100;
    this.pos = [
      11 * BLOCK_WIDTH + this.radius,
      10 * BLOCK_HEIGHT + this.radius,
    ]; // X, Y
  }

  draw() {
    const dirX = this.pos[0] + 20 * Math.cos(this.dir * DEG2RAD);
    const dirY = this.pos[1] + 20 * Math.sin(this.dir * DEG2RAD);
    ctx.strokeStyle = "#2f4";
    ctx.moveTo(this.pos[0], this.pos[1]);
    ctx.lineTo(dirX, dirY);
    ctx.stroke();
    ctx.closePath();

    ctx.beginPath();
    ctx.fillStyle = "#2f4";
    ctx.arc(this.pos[0], this.pos[1], this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Check collision at a specific position
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  checkCollisionAt(x, y) {
    for (let i = 0; i < MAP_WIDTH; i++) {
      for (let j = 0; j < MAP_HEIGHT; j++) {
        const block = worldMap[j][i];
        if (block === 0) continue;

        const blockX = i * BLOCK_WIDTH;
        const blockY = j * BLOCK_HEIGHT;

        if (
          checkCollisionCircleRec(
            x,
            y,
            this.radius,
            blockX,
            blockY,
            BLOCK_WIDTH,
            BLOCK_HEIGHT,
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /** @param {number} dt */
  update(dt) {
    // Store original position
    const oldX = this.pos[0];
    const oldY = this.pos[1];

    let newX = oldX;
    let newY = oldY;

    // Calculate movement
    let moveX = 0;
    let moveY = 0;

    // Forward/Backward movement
    if (Input.isHeld("ArrowUp")) {
      moveX += this.speed * Math.cos(this.dir * DEG2RAD) * dt;
      moveY += this.speed * Math.sin(this.dir * DEG2RAD) * dt;
    }
    if (Input.isHeld("ArrowDown")) {
      moveX -= this.speed * Math.cos(this.dir * DEG2RAD) * dt;
      moveY -= this.speed * Math.sin(this.dir * DEG2RAD) * dt;
    }

    // Strafe movement
    if (Input.isHeld("KeyA")) {
      moveX += this.speed * Math.cos((this.dir - 90) * DEG2RAD) * dt;
      moveY += this.speed * Math.sin((this.dir - 90) * DEG2RAD) * dt;
    }
    if (Input.isHeld("KeyD")) {
      moveX += this.speed * Math.cos((this.dir + 90) * DEG2RAD) * dt;
      moveY += this.speed * Math.sin((this.dir + 90) * DEG2RAD) * dt;
    }

    // Change Direction (no collision needed for rotation)
    if (Input.isHeld("ArrowRight")) {
      this.dir += 2.5; // Smoother rotation
    }
    if (Input.isHeld("ArrowLeft")) {
      this.dir -= 2.5;
    }

    // Keep direction within 0-360 range
    this.dir = ((this.dir % 360) + 360) % 360;

    // Try X movement first
    newX = oldX + moveX;
    if (!this.checkCollisionAt(newX, oldY)) {
      this.pos[0] = newX;
    }

    // Try Y movement
    newY = oldY + moveY;
    if (!this.checkCollisionAt(this.pos[0], newY)) {
      this.pos[1] = newY;
    }

    // If still colliding (edge cases), try diagonal movement
    if (this.checkCollisionAt(this.pos[0], this.pos[1])) {
      // Try both X and Y together
      if (!this.checkCollisionAt(oldX + moveX, oldY + moveY)) {
        this.pos[0] = oldX + moveX;
        this.pos[1] = oldY + moveY;
      } else {
        // Revert to original position if all else fails
        this.pos[0] = oldX;
        this.pos[1] = oldY;
      }
    }

    // Optional: Add sliding along walls
    this.handleWallSliding(oldX, oldY, moveX, moveY);

    Input.endFrame();
  }

  /**
   * Handle sliding along walls for smoother movement
   * @param {number} oldX
   * @param {number} oldY
   * @param {number} moveX
   * @param {number} moveY
   */
  handleWallSliding(oldX, oldY, moveX, moveY) {
    // If we're still colliding after normal resolution, try sliding
    if (this.checkCollisionAt(this.pos[0], this.pos[1])) {
      // Try sliding along X axis only
      if (!this.checkCollisionAt(oldX + moveX, oldY)) {
        this.pos[0] = oldX + moveX;
        this.pos[1] = oldY;
      }
      // Try sliding along Y axis only
      else if (!this.checkCollisionAt(oldX, oldY + moveY)) {
        this.pos[0] = oldX;
        this.pos[1] = oldY + moveY;
      }
      // If still colliding, revert completely
      else {
        this.pos[0] = oldX;
        this.pos[1] = oldY;
      }
    }
  }
}

function drawMinimap() {
  const minimapSize = 150;
  const minimapX = 10;
  const minimapY = SCREEN_HEIGHT - minimapSize - 10;
  const minimapBlockSize = minimapSize / MAP_WIDTH;

  // Draw minimap background
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);

  // Draw walls on minimap
  for (let i = 0; i < MAP_WIDTH; i++) {
    for (let j = 0; j < MAP_HEIGHT; j++) {
      const block = worldMap[j][i];
      if (block > 0) {
        ctx.fillStyle = wallColors[block] || "#808080";
        ctx.fillRect(
          minimapX + i * minimapBlockSize,
          minimapY + j * minimapBlockSize,
          minimapBlockSize - 1,
          minimapBlockSize - 1,
        );
      }
    }
  }

  // Draw player on minimap
  ctx.fillStyle = "#0f0";
  ctx.beginPath();
  ctx.arc(
    minimapX + (player.pos[0] / SCREEN_WIDTH) * minimapSize,
    minimapY + (player.pos[1] / SCREEN_HEIGHT) * minimapSize,
    3,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Draw player direction on minimap
  ctx.strokeStyle = "#0f0";
  ctx.beginPath();
  ctx.moveTo(
    minimapX + (player.pos[0] / SCREEN_WIDTH) * minimapSize,
    minimapY + (player.pos[1] / SCREEN_HEIGHT) * minimapSize,
  );
  ctx.lineTo(
    minimapX +
      (player.pos[0] / SCREEN_WIDTH) * minimapSize +
      Math.cos(player.dir * DEG2RAD) * 10,
    minimapY +
      (player.pos[1] / SCREEN_HEIGHT) * minimapSize +
      Math.sin(player.dir * DEG2RAD) * 10,
  );
  ctx.stroke();
}

class RayCaster {
  /** @param {Player} player **/
  constructor(player) {
    /** @type {Player} **/
    this.player = player;
    this.halfFov = player.fov / 2;
    this.numberOfRays = SCREEN_WIDTH;
    this.deltaAngle = player.fov / this.numberOfRays;
  }

  /** @param {number} rayAngle */
  castRay(rayAngle) {
    const rayAngleRad = rayAngle * DEG2RAD;

    const cosAngle = Math.cos(rayAngleRad);
    const sinAngle = Math.sin(rayAngleRad);

    let playerActualXPos = player.pos[0] / BLOCK_WIDTH,
      playerActualYPos = player.pos[1] / BLOCK_HEIGHT;

    let playerGridX = Math.floor(playerActualXPos),
      playerGridY = Math.floor(playerActualYPos);

    const deltaDistX = Math.abs(1 / (cosAngle || 0.000001));
    const deltaDistY = Math.abs(1 / (sinAngle || 0.000001));

    let sideDistX, sideDistY;
    let stepX, stepY;

    // Calculate step and initial side distance
    if (cosAngle < 0) {
      stepX = -1;
      sideDistX = (playerActualXPos - playerGridX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (playerGridX + 1.0 - playerActualXPos) * deltaDistX;
    }

    if (sinAngle < 0) {
      stepY = -1;
      sideDistY = (playerActualYPos - playerGridY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (playerGridY + 1.0 - playerActualYPos) * deltaDistY;
    }

    let hit = 0,
      side = 0, // 0 = East/West wall hit, 1 = North/South wall hit
      wallType = 0;

    let safetyCounter = 0;
    while (hit === 0 && safetyCounter < 50) {
      safetyCounter++;
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        playerGridX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        playerGridY += stepY;
        side = 1;
      }

      if (
        playerGridX >= 0 &&
        playerGridX < MAP_WIDTH &&
        playerGridY >= 0 &&
        playerGridY < MAP_HEIGHT
      ) {
        if (worldMap[playerGridY][playerGridX] > 0) {
          hit = 1;
          wallType = worldMap[playerGridY][playerGridX];
        }
      } else break;
    }

    let perpWallDist;
    if (side === 0)
      perpWallDist =
        (playerGridX - playerActualXPos + (1 - stepX) / 2) /
        (cosAngle || 0.000001);
    else if (side === 1)
      perpWallDist =
        (playerGridY - playerActualYPos + (1 - stepY) / 2) /
        (sinAngle || 0.000001);

    if (perpWallDist <= 0) perpWallDist = 0.01;

    const correctedDist =
      perpWallDist * Math.cos((rayAngle - player.dir) * DEG2RAD);

    return {
      distance: correctedDist,
      side,
      wallType,
      playerGridX,
      playerGridY,
    };
  }

  render() {
    const leftMostRay = player.dir - this.halfFov;
    for (let i = 0; i < this.numberOfRays; i++) {
      const rayOffset = i * this.deltaAngle;
      const currentRay = leftMostRay + rayOffset;
      const rayAngle = ((currentRay % 360) + 360) % 360;
      const ray = this.castRay(rayAngle);
      const lineHeight = Math.floor(SCREEN_HEIGHT / ray.distance);

      let drawStart = -lineHeight / 2 + SCREEN_HEIGHT / 2;
      if (drawStart < 0) drawStart = 0;
      let drawEnd = lineHeight / 2 + SCREEN_HEIGHT / 2;
      if (drawEnd >= SCREEN_HEIGHT) drawEnd = SCREEN_HEIGHT - 1;

      let baseColor = wallColors[ray.wallType] || "#808080";

      if (ray.side === 1) ctx.fillStyle = this.shadeColor(baseColor, -30);
      else if (ray.side === 0) ctx.fillStyle = baseColor;

      ctx.fillRect(i, drawStart, 1, drawEnd - drawStart);
    }
  }

  /**
   * @param {string} color
   * @param {number} percent
   */
  shadeColor(color, percent) {
    let num = parseInt(color.replace("#", ""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = ((num >> 8) & 0x00ff) + amt,
      B = (num & 0x0000ff) + amt;
    return (
      "#" +
      (
        0x1000000 +
        (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 0 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }
}

const player = new Player();
const rayCaster = new RayCaster(player);

function initGame() {
  TimerManager.clearAll();
  gameover = false;
  score = 0;
  scoreEl.textContent = "Score: 0";
}

function animate(currentTime) {
  if (!lastTime) lastTime = currentTime;
  // Convert millisecond delta to seconds slice
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;
  if (gameover) {
    drawGameOverScreen();
    if (Input.isPressed("Enter")) {
      initGame();
    }
    Input.endFrame();
    return;
  }

  TimerManager.update(currentTime - (lastTime - dt * 1000)); // Timers updated using ms
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw sky and floor
  ctx.fillStyle = "#87CEEB"; // Sky blue
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
  ctx.fillStyle = "#8B7355"; // Floor brown
  ctx.fillRect(0, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT / 2);

  rayCaster.render();
  drawMinimap();

  player.update(dt);

  animationID = requestAnimationFrame(animate);
}

// Global execution hooks
Input.init();
initGame();
animationID = requestAnimationFrame(animate);
