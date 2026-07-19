// @ts-check
"use strict";

/** @typedef {[number, number, number, number, number, number]} BranchQueueItem */

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas context 2D not supported");
document.body.appendChild(canvas);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.onresize = resize;
resize();

const DEG2RAD = Math.PI / 180;

// Config state read directly from UI
const config = {
  angleOffset: 25,
  startingAngle: -90,
  trunkLengthPct: 0.25,
  maxDepth: 11,
  branchesPerSecond: 40,
};

/**
 * @typedef {Object} Branch
 * @property {[number, number]} start
 * @property {[number, number]} end
 * @property {number} thickness
 * @property {number} depth
 */

/** @type {Branch[]} */
let allBranches = [];
let visibleBranchCount = 0;
let lastTime = 0;
let growthProgress = 0;

/**
 * Builds tree layout using Breadth-First Search (BFS)
 */
function generateTreeBFS() {
  allBranches = [];
  growthProgress = 0;
  visibleBranchCount = 0;

  const startX = canvas.width / 2;
  const startY = canvas.height;
  const initialLength = canvas.height * config.trunkLengthPct;
  const initialThickness = 18;
  const startAngleRad = config.startingAngle * DEG2RAD;
  const offsetRad = config.angleOffset * DEG2RAD;

  /** @type {BranchQueueItem[]} */
  const queue = [
    [startX, startY, initialLength, startAngleRad, initialThickness, 0],
  ];

  while (queue.length > 0) {
    const shiftedQueue = queue.shift();
    if (!shiftedQueue) break;
    const [x, y, len, angle, thick, depth] = shiftedQueue;

    if (depth >= config.maxDepth || len < 2) continue;

    const endX = x + len * Math.cos(angle);
    const endY = y + len * Math.sin(angle);

    allBranches.push({
      start: [x, y],
      end: [endX, endY],
      thickness: thick,
      depth,
    });

    const nextLen = len * 0.72;
    const nextThick = thick * 0.7;

    queue.push([endX, endY, nextLen, angle - offsetRad, nextThick, depth + 1]);
    queue.push([endX, endY, nextLen, angle + offsetRad, nextThick, depth + 1]);
  }
}

// Attach UI Event Listeners
function setupUI() {
  const getEl = (/** @type {string} */ id) =>
    /** @type {HTMLInputElement} */ (document.getElementById(id));

  /**
   * @param {string} id
   * @param {string} valId
   * @param {keyof config} key
   * @param {(v: number) => number} [transform]
   **/
  const bindInput = (id, valId, key, transform = (v) => v) => {
    const input = getEl(id);
    const display = document.getElementById(valId);
    input.addEventListener("input", () => {
      const val = Number(input.value);
      if (display) display.textContent = String(val);
      config[key] = transform(val);
      generateTreeBFS();
    });
  };

  bindInput("angleOffset", "angleOffsetVal", "angleOffset");
  bindInput("startingAngle", "startingAngleVal", "startingAngle");
  bindInput("trunkLength", "trunkLengthVal", "trunkLengthPct", (v) => v / 100);
  bindInput("maxDepth", "maxDepthVal", "maxDepth");
  bindInput("growthSpeed", "growthSpeedVal", "branchesPerSecond");

  const btnRestart = document.getElementById("btnRestart");
  if (btnRestart) {
    btnRestart.addEventListener("click", () => generateTreeBFS());
  }
}

// Init UI & Tree
setupUI();
generateTreeBFS();

/** @param {number} currentTime */
function animate(currentTime) {
  if (!lastTime) lastTime = currentTime;
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  if (visibleBranchCount < allBranches.length) {
    growthProgress += dt * config.branchesPerSecond;
    visibleBranchCount = Math.floor(growthProgress);
  }

  if (ctx) {
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const countToDraw = Math.min(visibleBranchCount, allBranches.length);

    for (let i = 0; i < countToDraw; i++) {
      const branch = allBranches[i];
      ctx.beginPath();
      ctx.moveTo(branch.start[0], branch.start[1]);
      ctx.lineTo(branch.end[0], branch.end[1]);

      const greenRatio = Math.min(branch.depth / config.maxDepth, 1);
      ctx.strokeStyle = `rgb(${100 - greenRatio * 60}, ${70 + greenRatio * 110}, 50)`;
      ctx.lineWidth = branch.thickness;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
