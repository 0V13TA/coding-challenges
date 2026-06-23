"use strict";

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 700;
canvas.height = 350;
document.body.appendChild(canvas);

const entityWidth = canvas.width * 0.03;
const entityHeight = canvas.height * 0.3;

let animation;
let score = 0;
let lastTime = 0;
let keyPressed = "";
const enemyArray = [];

const scoreEl = document.querySelector("#score");

// --- Timer Manager ---
const TimerManager = {
  timers: [],
  counterId: 0,

  add(interval, callback) {
    const id = this.counterId++;
    this.timers.push({ id, interval, callback, elapsed: 0, paused: false });
    return id;
  },

  update(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if (t.paused) continue;
      t.elapsed += dt;
      if (t.elapsed >= t.interval) {
        t.callback();
        t.elapsed -= t.interval;
      }
    }
  },
};

// --- Collision Logic (Standard AABB) ---
/**
 * @param {Object} a - First entity
 * @param {Object} b - Second entity
 */
function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// --- Enemy Class ---
class Enemy {
  constructor() {
    this.speed = 0.3; // Speed in pixels per ms
    this.width = entityWidth;
    this.height = entityHeight;
    this.x = canvas.width; // Start exactly at the right edge
    this.y = canvas.height - this.height;
    this.passed = false;
  }

  draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  update(dt) {
    this.x -= this.speed * dt;
  }
}

// --- Player Class ---
class Player {
  constructor() {
    this.width = entityWidth;
    this.height = entityHeight;
    this.x = 50; // Set to the left side like a runner game
    this.y = canvas.height - this.height;

    this.velocityY = 0;
    this.gravity = 0.0015; // Gravity strength
    this.jumpStrength = -0.9; // Negative moves UP
    this.isGrounded = true;
  }

  draw() {
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  update(dt) {
    // Jump Logic
    if (this.isGrounded && (keyPressed === "ArrowUp" || keyPressed === " ")) {
      this.velocityY = this.jumpStrength;
      this.isGrounded = false;
    }

    // Apply Physics
    this.velocityY += this.gravity * dt;
    this.y += this.velocityY * dt;

    // Floor Collision
    if (this.y + this.height > canvas.height) {
      this.y = canvas.height - this.height;
      this.velocityY = 0;
      this.isGrounded = true;
    }
  }
}

// --- Initialization ---
const player = new Player();
TimerManager.add(1500, () => enemyArray.push(new Enemy()));

function animate(currentTime) {
  // Handle the first frame where currentTime is undefined
  if (!lastTime) lastTime = currentTime;
  const dt = Math.min(currentTime - lastTime, 100);
  lastTime = currentTime;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  TimerManager.update(dt);
  player.update(dt);
  player.draw();

  // Update and Draw Enemies
  for (let i = enemyArray.length - 1; i >= 0; i--) {
    const enemy = enemyArray[i];
    enemy.update(dt);
    enemy.draw();

    // Collision Check
    if (checkCollision(player, enemy)) {
      alert(`Game Over! Score: ${score}`);
      location.reload();
      return; // Stop the loop
    }

    // 2. Scoring Logic
    // If the enemy passes the player's right side and isn't marked as 'passed'
    if (!enemy.passed && enemy.x + enemy.width < player.x) {
      score++;
      enemy.passed = true; // Mark it so we don't count it again next frame
      if (scoreEl) scoreEl.innerText = `Score: ${score}`;
    }

    // Cleanup off-screen enemies
    if (enemy.x + enemy.width < 0) {
      enemyArray.splice(i, 1);
    }
  }

  animation = requestAnimationFrame(animate);
}

// --- Event Listeners ---
addEventListener("keydown", (e) => (keyPressed = e.key));
addEventListener("keyup", () => (keyPressed = ""));

// Start
requestAnimationFrame(animate);
