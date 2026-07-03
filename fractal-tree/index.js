// @ts-check
"use strict";

/**
 * @typedef Timer
 * @property {number} id
 * @property {number} elapsed
 * @property {boolean} paused
 * @property {boolean} repeat
 * @property {number} interval
 * @property {() => void} callback
 */

//#region Init
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

document.body.appendChild(canvas);

canvas.width = window.innerWidth * 0.99;
canvas.height = window.innerHeight * 0.99;

let animationID;
let lastTime = 0;
//#endregion

// --- Timer Manager ---
const TimerManager = {
  /** @type {Timer[]} */
  timers: [],
  counterId: 0,

  /**
   * @param {number} interval
   * @param {() => void} callback
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

  /**
   * @param {number} interval
   * @param {() => void} callback
   */
  setInterval(interval, callback) {
    return this.add(interval, callback, true);
  },

  /**
   * @param {number} dt
   */
  update(dt) {
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
  /** @type {Set<string>} */
  held: new Set(),
  /** @type {Set<string>} */
  pressed: new Set(),
  /** @type {Set<string>} */
  released: new Set(),
  init() {
    window.addEventListener("keydown", (e) => {
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

  /** @param {string} key  */
  isHeld(key) {
    return this.held.has(key);
  },

  /** @param {string} key  */
  isPressed(key) {
    return this.pressed.has(key);
  },

  /** @param {string} key  */
  isReleased(key) {
    return this.released.has(key);
  },

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  },
};

function initGame() {
  TimerManager.clearAll();
  lastTime = 0;
  animationID = requestAnimationFrame(animate);
}

/** @param {number} currentTime   */
function animate(currentTime) {
  if (!lastTime) lastTime = currentTime;
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  TimerManager.update(currentTime - (lastTime - dt * 1000));
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background/canvas placeholder draw loop
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  Input.endFrame();
  animationID = requestAnimationFrame(animate);
}

// Global execution hooks
Input.init();
animationID = requestAnimationFrame(animate);
