"use strict";

//#region Type Definitions
type KeyCode = string;

interface Timer {
  id: number;
  elapsed: number;
  paused: boolean;
  repeat: boolean;
  interval: number;
  callback: () => void;
}

interface BoxEntity {
  x: number;
  y: number;
  width: number;
  height: number;
}
//#endregion

//#region Init
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const scoreEl = document.createElement("p");
scoreEl.classList.add("score");
scoreEl.textContent = "Score: 0";

document.body.appendChild(canvas);
document.body.appendChild(scoreEl);

canvas.width = window.innerWidth * 0.99;
canvas.height = window.innerHeight * 0.99;

let score: number = 0;
let animationID: number;
let lastTime: number = 0;
let gameover: boolean = false;
//#endregion

// --- Timer Manager ---
const TimerManager = {
  timers: [] as Timer[],
  counterId: 0,

  add(interval: number, callback: () => void, repeat: boolean = true): number {
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

  setInterval(interval: number, callback: () => void): number {
    return this.add(interval, callback, true);
  },

  update(dt: number): void {
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

  clearAll(): void {
    this.timers = [];
    this.counterId = 0;
  },
};

// --- Input Handling ---
const Input = {
  held: new Set<KeyCode>(),
  pressed: new Set<KeyCode>(),
  released: new Set<KeyCode>(),

  init(): void {
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this.held.has(e.code)) {
        this.pressed.add(e.code);
      }
      this.held.add(e.code);
    });

    window.addEventListener("keyup", (e: KeyboardEvent) => {
      this.held.delete(e.code);
      this.released.add(e.code);
    });
  },

  isHeld(key: KeyCode): boolean {
    return this.held.has(key);
  },

  isPressed(key: KeyCode): boolean {
    return this.pressed.has(key);
  },

  isReleased(key: KeyCode): boolean {
    return this.released.has(key);
  },

  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
  },
};

// --- Collision Logic (Standard AABB) ---
function checkCollision(a: BoxEntity, b: BoxEntity): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function checkCollisionCircleRec(
  centerX: number,
  centerY: number,
  radius: number,
  recX: number,
  recY: number,
  recWidth: number,
  recHeight: number,
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

function drawGameOverScreen(): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "40px sans-serif";
  const text = "GAME OVER";
  const size = ctx.measureText(text);
  ctx.fillText(text, canvas.width / 2 - size.width / 2, canvas.height / 2);
}

function initGame(): void {
  TimerManager.clearAll();
  gameover = false;
  score = 0;
  scoreEl.textContent = "Score: 0";
  lastTime = 0;
  animationID = requestAnimationFrame(animate);
}

function animate(currentTime: number): void {
  if (!lastTime) lastTime = currentTime;
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

  TimerManager.update(currentTime - (lastTime - dt * 1000));
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background/canvas placeholder draw loop
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  const text = "This is a template project";
  ctx.font = "25px serif";
  const textSize = ctx.measureText(text);
  ctx.fillText(text, canvas.width / 2 - textSize.width / 2, canvas.height / 2);

  Input.endFrame();
  animationID = requestAnimationFrame(animate);
}

// Global execution hooks
Input.init();
animationID = requestAnimationFrame(animate);
