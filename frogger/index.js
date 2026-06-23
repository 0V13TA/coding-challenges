"use strict";

/**
 * @callback requestCallback
 * @returns void
 *
 * @typedef {Object} timer
 * @property {number} id
 * @property {number} elapsed
 * @property {boolean} paused
 * @property {boolean} repeat
 * @property {number} interval
 * @property {requestCallback} callback
 *
 * @typedef {Object} Rect
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

//#region Init
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.createElement("p");
scoreEl.classList.add("score");
scoreEl.style.color = "white";
scoreEl.style.fontSize = "24px";
scoreEl.style.fontFamily = "sans-serif";
scoreEl.textContent = "Score: 0";

document.body.appendChild(canvas);
document.body.appendChild(scoreEl);

canvas.width = window.innerWidth * 0.99;
canvas.height = window.innerHeight * 0.99;

const ROAD_ENTITY_WIDTH = canvas.width;
const ROAD_ENTITY_HEIGHT = canvas.height / 20; // Exact lane heights matching map length

let score = 0;
let highestLaneReached = 19;
let animationID;
let lastTime = 0;
let gameover = false;

/** @type {Road[]} */
let roads = [];

const map = [
  ["PAVEMENT", 0], // Win zone row 0
  ["PAVEMENT", 0], // Row 1
  ["WATER", -120], // Row 2 (speeds adjusted to px/sec)
  ["WATER", 100], // Row 3
  ["WATER", -90], // Row 4
  ["WATER", 140], // Row 5
  ["PAVEMENT", 0], // Row 6
  ["PAVEMENT", 0], // Row 7
  ["ROAD", 150], // Row 8
  ["ROAD", -110], // Row 9
  ["ROAD", 180], // Row 10
  ["ROAD", -130], // Row 11
  ["PAVEMENT", 0], // Row 12
  ["PAVEMENT", 0], // Row 13
  ["ROAD", 160], // Row 14
  ["ROAD", -100], // Row 15
  ["ROAD", 140], // Row 16
  ["ROAD", -120], // Row 17
  ["PAVEMENT", 0], // Row 18
  ["PAVEMENT", 0], // Starting Zone Row 19
];
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

  isPressed(key) {
    return this.pressed.has(key);
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

class RoadEntity {
  /**
   * @param {1 | -1} direction
   * @param {"CAR", "LOG", "BUS"} type
   * @param {number} offsetY
   **/
  constructor(direction, type, offsetY) {
    this.width = ROAD_ENTITY_WIDTH * 0.08;
    this.height = ROAD_ENTITY_HEIGHT - 10;
    this.type = type;

    switch (type) {
      case "CAR":
        this.color = "#ff4500";
        break;
      case "LOG":
        this.color = "#8b5a2b"; // True log brown
        this.width = ROAD_ENTITY_WIDTH * (Math.random() * 0.08 + 0.1);
        break;
      case "BUS":
        this.color = "#00ff7f";
        this.width = ROAD_ENTITY_WIDTH * 0.15;
        break;
    }

    this.y = (ROAD_ENTITY_HEIGHT - this.height) / 2 + offsetY;
    // Spawn out of view borders depending on orientation direction
    this.x = direction === 1 ? -this.width : ROAD_ENTITY_WIDTH;
    this.direction = direction;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

class Road {
  constructor(y, direction, type, speed) {
    this.x = 0;
    this.y = y;
    this.speed = speed; // Velocity in pixels per second
    this.type = type;
    this.direction = direction; // 1 = Right, -1 = Left
    this.width = ROAD_ENTITY_WIDTH;
    this.height = ROAD_ENTITY_HEIGHT;
    /** @type {RoadEntity[]} */
    this.roadEntities = [];

    switch (type) {
      case "ROAD":
        this.color = "#1a1a1a";
        break;
      case "WATER":
        this.color = "#104e8b";
        break;
      case "PAVEMENT":
        this.color = "#4a4a4a";
        break;
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Draw dashed lane lines for roads to make it look nicer
    if (this.type === "ROAD") {
      ctx.strokeStyle = "#ffffff";
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, this.y);
      ctx.lineTo(this.width, this.y);
      ctx.stroke();
    }

    this.roadEntities.forEach((entity) => entity.draw());
  }

  /** @param {number} dt (seconds) */
  update(dt) {
    for (let i = this.roadEntities.length - 1; i >= 0; i--) {
      const entity = this.roadEntities[i];
      entity.x += this.speed * this.direction * dt;

      // Despawn buffers
      if (this.direction === 1 && entity.x > this.width) {
        this.roadEntities.splice(i, 1);
      } else if (this.direction === -1 && entity.x + entity.width < 0) {
        this.roadEntities.splice(i, 1);
      }
    }
  }
}

class Frog {
  constructor() {
    this.width = ROAD_ENTITY_HEIGHT - 12;
    this.height = ROAD_ENTITY_HEIGHT - 12;
    this.roadCenterOffset = (ROAD_ENTITY_HEIGHT - this.height) / 2;
    this.reset();
    this.color = "#32cd32"; // Green frog!
  }

  reset() {
    this.x = ROAD_ENTITY_WIDTH / 2 - this.width / 2;
    this.currentLane = 19;
    this.y = this.roadCenterOffset + ROAD_ENTITY_HEIGHT * this.currentLane;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  /** @param {number} dt (seconds) */
  update(dt) {
    // Handling step movements accurately
    if (Input.isPressed("ArrowUp") || Input.isPressed("KeyW")) {
      if (this.currentLane > 0) {
        this.currentLane--;
        this.y -= ROAD_ENTITY_HEIGHT;

        // Progression scoring update
        if (this.currentLane < highestLaneReached) {
          score += 10;
          highestLaneReached = this.currentLane;
          scoreEl.textContent = `Score: ${score}`;
        }
      }
    }
    if (Input.isPressed("ArrowDown") || Input.isPressed("KeyS")) {
      if (this.currentLane < map.length - 1) {
        this.currentLane++;
        this.y += ROAD_ENTITY_HEIGHT;
      }
    }
    if (Input.isPressed("ArrowLeft") || Input.isPressed("KeyA")) {
      this.x -= ROAD_ENTITY_HEIGHT; // Move horizontally relative to grid size steps
      if (this.x < 0) this.x = 0;
    }
    if (Input.isPressed("ArrowRight") || Input.isPressed("KeyD")) {
      this.x += ROAD_ENTITY_HEIGHT;
      if (this.x + this.width > canvas.width)
        this.x = canvas.width - this.width;
    }

    // Win condition check
    if (this.currentLane === 0) {
      score += 200; // Level win bonus!
      scoreEl.textContent = `Score: ${score}`;
      highestLaneReached = 19;
      this.reset();
      return;
    }

    // Evaluate hazards and log-riding constraints
    const activeRoad = roads[this.currentLane];
    if (activeRoad) {
      if (activeRoad.type === "ROAD") {
        activeRoad.roadEntities.forEach((vehicle) => {
          if (checkCollision(this, vehicle)) {
            triggerGameOver();
          }
        });
      } else if (activeRoad.type === "WATER") {
        let standingOnLog = false;

        activeRoad.roadEntities.forEach((log) => {
          if (checkCollision(this, log)) {
            standingOnLog = true;
            // Carry frog with log speed displacement vector
            this.x += activeRoad.speed * activeRoad.direction * dt;
          }
        });

        // Drowned inside water stream, or drifted completely off the game screens
        if (
          !standingOnLog ||
          this.x < 0 ||
          this.x + this.width > canvas.width
        ) {
          triggerGameOver();
        }
      }
    }

    Input.endFrame();
  }
}

const frog = new Frog();

/** @param {Road} road */
function spawnRoadEntities(road) {
  if (road.type === "ROAD") {
    TimerManager.setInterval(1200 + Math.random() * 800, () => {
      road.roadEntities.push(
        new RoadEntity(
          road.direction,
          Math.floor(Math.random() * 2) === 0 ? "CAR" : "BUS",
          road.y,
        ),
      );
    });
  }

  if (road.type === "WATER") {
    TimerManager.setInterval(1500 + Math.random() * 1000, () => {
      road.roadEntities.push(new RoadEntity(road.direction, "LOG", road.y));
    });
  }
}

function initGame() {
  roads = [];
  TimerManager.clearAll();
  gameover = false;
  score = 0;
  highestLaneReached = 19;
  scoreEl.textContent = "Score: 0";
  frog.reset();

  for (let i = 0; i < map.length; i++) {
    const y = ROAD_ENTITY_HEIGHT * i;
    const roadType = map[i][0];
    const rawSpeed = map[i][1];
    const direction = rawSpeed < 0 ? -1 : 1;

    const road = new Road(y, direction, roadType, Math.abs(rawSpeed));
    spawnRoadEntities(road);
    roads.push(road);
  }
}

function triggerGameOver() {
  gameover = true;
}

function drawGameOverScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ff3333";
  ctx.font = "bold 48px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = "#ffffff";
  ctx.font = "20px sans-serif";
  ctx.fillText(
    "Press ENTER to Play Again",
    canvas.width / 2,
    canvas.height / 2 + 30,
  );
}

function animate(currentTime) {
  if (!lastTime) lastTime = currentTime;
  // Convert millisecond delta to seconds slice
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  if (!gameover) {
    TimerManager.update(currentTime - (lastTime - dt * 1000)); // Timers updated using ms
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    roads.forEach((road) => road.update(dt));
    frog.update(dt);

    roads.forEach((road) => road.draw());
    frog.draw();
  } else {
    drawGameOverScreen();
    if (Input.isPressed("Enter")) {
      initGame();
    }
    Input.endFrame();
  }

  animationID = requestAnimationFrame(animate);
}

// Global execution hooks
Input.init();
initGame();
animationID = requestAnimationFrame(animate);
