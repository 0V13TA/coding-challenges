const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.createElement("p");
scoreEl.classList.add("score");
scoreEl.textContent = "Score: 0";

document.body.appendChild(canvas);
document.body.appendChild(scoreEl);

const BLOCK_WIDTH = 20;
const BLOCK_HEIGTH = 20;
canvas.width = BLOCK_WIDTH * 30;
canvas.height = BLOCK_HEIGTH * 30;

let score = 0;
let animationID;
let lastTime = 0;
// Pick a random column (0 to 59) and multiply by block width
// Pick a random row (0 to 59) and multiply by block height
let food = {
  x: Math.floor(Math.random() * (canvas.width / BLOCK_WIDTH)) * BLOCK_WIDTH,
  y: Math.floor(Math.random() * (canvas.height / BLOCK_HEIGTH)) * BLOCK_HEIGTH,
};

// --- Timer Manager ---
const TimerManager = {
  /**
   * @type {{
   * id: number;
   * interval: number;
   * callback: Function;
   * elapsed: number;
   * paused: boolean;
   * repeat: boolean
   * }[]}
   */
  timers: [],
  counterId: 0,

  /**
   * @param {number} interval
   * @param {Function} callback
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
   * @param {number} id
   */
  pause(id) {
    const timer = this.timers.find((timer) => timer.id === id);
    if (timer === undefined) return;
    timer.paused = true;
  },

  /**
   * @param {number} id
   */
  resume(id) {
    const timer = this.timers.find((timer) => timer.id === id);
    if (timer === undefined) return;
    timer.paused = false;
  },

  /**
   * @param {number} interval
   * @param {Function} callback
   */
  setInterval(interval, callback) {
    return this.add(interval, callback, true);
  },

  /**
   * @param {number} delay
   * @param {Function} callback
   */
  setTimeout(delay, callback) {
    return this.add(delay, callback, false);
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
};

// --- Input Handling ---
/**
 * @typedef {
 * "ArrowUp" |
 * "ArrowLeft" |
 * "ArrowDown" |
 * "ArrowRight" |
 * "W" |
 * "A" |
 * "S" |
 * "D" |
 * " " |
 * "w" |
 * "a" |
 * "s" |
 * "d" |
 * "Shift" |
 * "Control" |
 * "Alt"
 * } Keys
 */
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

class Snake {
  constructor() {
    // Start with a few blocks so you can see the movement
    this.snakeBlocks = [
      {
        xPos: Math.floor(20 / 2) * BLOCK_WIDTH,
        yPos: Math.floor(20 / 2) * BLOCK_HEIGTH,
      },
    ];
    this.color = "#ffff00";
    this.justAte = false;
    /**
     * @type {"UP" | "DOWN" | "LEFT" | "RIGHT" | ""}
     */
    this.direction = "";
    /**
     * @type {"UP" | "DOWN" | "LEFT" | "RIGHT" | ""}
     */
    this.nextDirection = ""; // Our "Buffer" to store the next move
  }

  addSnakeBlock() {
    // Just push a copy of the tail; it will unfold naturally on the next move
    const lastBlock = this.snakeBlocks[this.snakeBlocks.length - 1];
    this.snakeBlocks.push({ ...lastBlock });
  }

  draw() {
    ctx.beginPath();
    ctx.fillStyle = this.color;
    this.snakeBlocks.forEach((block) => {
      ctx.fillRect(block.xPos, block.yPos, BLOCK_WIDTH - 1, BLOCK_HEIGTH - 1);
    });

    // 3. Draw Food
    ctx.beginPath();
    ctx.fillStyle = "#ff0000"; // Red food
    ctx.fillRect(food.x, food.y, BLOCK_WIDTH - 1, BLOCK_HEIGTH - 1);
  }

  update() {
    // 1. "Raylib Style" Input Polling
    // We check our Input object and store the intent in nextDirection
    if (Input.isPressed("ArrowUp") || Input.isPressed("KeyW")) {
      if (this.direction !== "DOWN") this.nextDirection = "UP";
    } else if (Input.isPressed("ArrowDown") || Input.isPressed("KeyS")) {
      if (this.direction !== "UP") this.nextDirection = "DOWN";
    } else if (Input.isPressed("ArrowLeft") || Input.isPressed("KeyA")) {
      if (this.direction !== "RIGHT") this.nextDirection = "LEFT";
    } else if (Input.isPressed("ArrowRight") || Input.isPressed("KeyD")) {
      if (this.direction !== "LEFT") this.nextDirection = "RIGHT";
    }

    const head = this.snakeBlocks[0];

    // 2. Only move if a direction is set
    if (!this.nextDirection) return;
    this.direction = this.nextDirection;

    // 3. THE MAGIC TRICK: Move the body
    // Instead of complex math, every block simply takes the position
    // of the block that was in front of it.
    for (let i = this.snakeBlocks.length - 1; i > 0; i--) {
      this.snakeBlocks[i].xPos = this.snakeBlocks[i - 1].xPos;
      this.snakeBlocks[i].yPos = this.snakeBlocks[i - 1].yPos;
    }

    // 4. Move the Head
    switch (this.direction) {
      case "UP":
        head.yPos -= BLOCK_HEIGTH;
        this.justAte = false;
        break;
      case "DOWN":
        head.yPos += BLOCK_HEIGTH;
        this.justAte = false;
        break;
      case "LEFT":
        head.xPos -= BLOCK_WIDTH;
        this.justAte = false;
        break;
      case "RIGHT":
        head.xPos += BLOCK_WIDTH;
        this.justAte = false;
        break;
    }

    // 1. Check for Food Collision (since everything is grid-snapped, we check exact positions)
    if (head.xPos === food.x && head.yPos === food.y) {
      score += 10;
      this.addSnakeBlock();
      this.justAte = true;
      scoreEl.textContent = `Score: ${score}`;

      // 2. Relocate Food to a new random grid spot
      food.x =
        Math.floor(Math.random() * (canvas.width / BLOCK_WIDTH)) * BLOCK_WIDTH;
      food.y =
        Math.floor(Math.random() * (canvas.height / BLOCK_HEIGTH)) *
        BLOCK_HEIGTH;
    }

    this.snakeBlocks.forEach((snake) => {
      if (snake === head) return;
      if (head.xPos === snake.xPos && head.yPos === snake.yPos && !this.justAte)
        clearInterval(animationID);
    });

    if (
      head.xPos + BLOCK_WIDTH > canvas.width ||
      head.xPos < 0 ||
      head.yPos + BLOCK_HEIGTH > canvas.height ||
      head.yPos < 0
    )
      clearInterval(animationID);

    // Crucial: Clear inputs at the end of the logic frame
    Input.endFrame();
  }
}

const snake = new Snake();
// --- Fix the Game Loop ---
// Your setInterval was passing '0' to animate, breaking your dt calculations.
// This simple loop runs the game at a consistent "Snake Speed".
animationID = setInterval(() => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // // Optional: Draw grid lines for visual help
  // ctx.strokeStyle = "#333";
  // for (let x = 0; x < canvas.width; x += BLOCK_WIDTH) {
  //   ctx.beginPath();
  //   ctx.moveTo(x, 0);
  //   ctx.lineTo(x, canvas.height);
  //   ctx.stroke();
  // }
  // for (let y = 0; y < canvas.height; y += BLOCK_HEIGTH) {
  //   ctx.beginPath();
  //   ctx.moveTo(0, y);
  //   ctx.lineTo(canvas.width, y);
  //   ctx.stroke();
  // }
  snake.update();
  snake.draw();
}, 100); // 100ms = 10 frames per second (Classic Snake speed)

Input.init();
