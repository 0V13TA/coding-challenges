import { Registry } from "./ecs";
import {
  applyDamage,
  clamp,
  createEnemy,
  createPlayer,
  createPowerUp,
  firePlayerShot,
  updateBullets,
  updateEnemies,
  updatePlayerController,
} from "./systems";
import { Input } from "./utils";
import "./style.css";

type GameState = {
  score: number;
  lives: number;
  wave: number;
  spawnTimer: number;
  shotCooldown: number;
  playerInvulnerable: number;
  spreadTimer: number;
  rapidTimer: number;
  shieldTimer: number;
  time: number;
  gameOver: boolean;
};

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d")!;
const app = document.getElementById("app");

if (!app) throw new Error("Div with ID app must exist");

function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
app.append(canvas);
Input.init(canvas);

const registry = new Registry();
for (const componentName of [
  "enemy",
  "effect",
  "pickUp",
  "powerUp",
  "bullet",
  "render",
  "health",
  "inventory",
  "transform",
] as const) {
  registry.createComponent(componentName);
}

const state: GameState = {
  score: 0,
  lives: 3,
  wave: 1,
  spawnTimer: 0.8,
  shotCooldown: 0,
  playerInvulnerable: 0,
  spreadTimer: 0,
  rapidTimer: 0,
  shieldTimer: 0,
  time: 0,
  gameOver: false,
};

let player = createPlayer(registry, 96, canvas.height / 2);
let lastFrame = performance.now();

function resetGame(): void {
  for (const entity of [...registry.view("enemy", "transform")]) {
    registry.destroyEntity(entity);
  }
  for (const entity of [...registry.view("bullet", "transform")]) {
    registry.destroyEntity(entity);
  }
  for (const entity of [...registry.view("powerUp", "transform")]) {
    registry.destroyEntity(entity);
  }

  player = createPlayer(registry, 96, canvas.height / 2);
  state.score = 0;
  state.lives = 3;
  state.wave = 1;
  state.spawnTimer = 0.8;
  state.shotCooldown = 0;
  state.playerInvulnerable = 0;
  state.spreadTimer = 0;
  state.rapidTimer = 0;
  state.shieldTimer = 0;
  state.time = 0;
  state.gameOver = false;
}

function spawnEnemyWave(): void {
  const kinds: Array<"NORMALS" | "RAIDERS" | "PURSUERS" | "HEAVY_TANKS"> = [
    "NORMALS",
    "NORMALS",
    "RAIDERS",
    "PURSUERS",
    "HEAVY_TANKS",
  ];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const y = 40 + Math.random() * (canvas.height - 120);
  createEnemy(registry, canvas.width + 60, y, kind);
}

function handlePlayerCombat(dt: number): void {
  if (state.gameOver) return;

  state.shotCooldown -= dt;
  const spreadActive = state.spreadTimer > 0;
  const rapidActive = state.rapidTimer > 0;

  if ((Input.isMousePressed(0) || Input.isKeyHeld("Space")) && state.shotCooldown <= 0) {
    firePlayerShot(registry, player, spreadActive);
    state.shotCooldown = rapidActive ? 0.08 : 0.17;
  }
}

function collectPowerUp(type: "SPREAD" | "RAPID" | "SHIELD"): void {
  if (type === "SPREAD") {
    state.spreadTimer = 8;
  } else if (type === "RAPID") {
    state.rapidTimer = 8;
  } else {
    state.shieldTimer = 10;
  }
}

function handleCollisions(): void {
  const playerTransform = registry.getData(player, "transform");
  if (!playerTransform) return;

  const powerUps = registry.view("powerUp", "transform");
  for (const powerUp of powerUps) {
    const powerUpData = registry.getData(powerUp, "powerUp");
    const transform = registry.getData(powerUp, "transform");
    if (!powerUpData || !transform) continue;

    const distance = Math.hypot(playerTransform.x - transform.x, playerTransform.y - transform.y);
    if (distance < 18) {
      collectPowerUp(powerUpData.type);
      registry.destroyEntity(powerUp);
    }
  }

  const bullets = registry.view("bullet", "transform");
  for (const bullet of bullets) {
    const bulletData = registry.getData(bullet, "bullet");
    const transform = registry.getData(bullet, "transform");
    if (!bulletData || !transform) continue;

    if (bulletData.owner === "PLAYER") {
      const enemies = registry.view("enemy", "transform", "health");
      for (const enemy of enemies) {
        const enemyTransform = registry.getData(enemy, "transform");
        if (!enemyTransform) continue;

        const distance = Math.hypot(
          enemyTransform.x - transform.x,
          enemyTransform.y - transform.y,
        );
        if (distance < (enemyTransform.width + transform.width) * 0.45) {
          const killed = applyDamage(registry, enemy, bulletData.attackPower);
          registry.destroyEntity(bullet);
          if (killed) {
            const enemyData = registry.getData(enemy, "enemy");
            if (enemyData) {
              state.score += enemyData.scoreValue;
              if (Math.random() < 0.18) {
                const powerTypes: Array<"SPREAD" | "RAPID" | "SHIELD"> = ["SPREAD", "RAPID", "SHIELD"];
                const kind = powerTypes[Math.floor(Math.random() * powerTypes.length)];
                createPowerUp(registry, enemyTransform.x, enemyTransform.y, kind);
              }
            }
            registry.destroyEntity(enemy);
          }
          break;
        }
      }
    } else {
      const hitDistance = Math.hypot(
        playerTransform.x - transform.x,
        playerTransform.y - transform.y,
      );
      if (hitDistance < 20) {
        registry.destroyEntity(bullet);
        if (state.shieldTimer > 0) {
          continue;
        }
        if (state.playerInvulnerable <= 0) {
          state.lives -= 1;
          state.playerInvulnerable = 1.25;
          if (state.lives <= 0) {
            state.gameOver = true;
          }
        }
      }
    }
  }

  const enemies = registry.view("enemy", "transform");
  for (const enemy of enemies) {
    const enemyTransform = registry.getData(enemy, "transform");
    if (!enemyTransform) continue;

    const distance = Math.hypot(
      playerTransform.x - enemyTransform.x,
      playerTransform.y - enemyTransform.y,
    );
    if (distance < 24) {
      const enemyData = registry.getData(enemy, "enemy");
      const powerRoll = Math.random();
      if (powerRoll < 0.18) {
        const powerTypes: Array<"SPREAD" | "RAPID" | "SHIELD"> = ["SPREAD", "RAPID", "SHIELD"];
        const kind = powerTypes[Math.floor(Math.random() * powerTypes.length)];
        createPowerUp(registry, enemyTransform.x, enemyTransform.y, kind);
      }
      if (enemyData) {
        state.score += enemyData.scoreValue;
      }
      registry.destroyEntity(enemy);
      if (state.shieldTimer > 0) {
        continue;
      }
      if (state.playerInvulnerable <= 0) {
        state.lives -= 1;
        state.playerInvulnerable = 1.25;
      }
      if (state.lives <= 0) {
        state.gameOver = true;
      }
    }
  }
}

function updateGame(dt: number): void {
  if (state.gameOver) return;

  state.time += dt;
  state.wave = 1 + Math.floor(state.score / 800);
  state.playerInvulnerable = Math.max(0, state.playerInvulnerable - dt);
  state.spreadTimer = Math.max(0, state.spreadTimer - dt);
  state.rapidTimer = Math.max(0, state.rapidTimer - dt);
  state.shieldTimer = Math.max(0, state.shieldTimer - dt);
  state.spawnTimer -= dt;

  if (state.spawnTimer <= 0) {
    spawnEnemyWave();
    state.spawnTimer = Math.max(0.42, 1.6 - state.wave * 0.14);
  }

  updatePlayerController(registry, player, dt);
  const playerTransform = registry.getData(player, "transform");
  if (playerTransform) {
    playerTransform.x = clamp(playerTransform.x, 30, canvas.width - 30);
    playerTransform.y = clamp(playerTransform.y, 30, canvas.height - 30);
  }

  handlePlayerCombat(dt);
  updateEnemies(registry, player, dt, state.time);
  updateBullets(registry, dt);
  handleCollisions();
}

function drawBackground(): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.7, "#1e3a8a");
  gradient.addColorStop(1, "#0b1020");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 90; i += 1) {
    const x = ((i * 137) % canvas.width) - 20;
    const y = ((i * 93) % canvas.height) - 20;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillRect(x + (state.time * 30) % (canvas.width + 40), y, 2, 2);
  }

  ctx.fillStyle = "rgba(248, 250, 252, 0.15)";
  ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
}

function drawEnemy(entity: number): void {
  const transform = registry.getData(entity, "transform");
  const render = registry.getData(entity, "render");
  if (!transform || !render) return;

  ctx.fillStyle = render.color;
  ctx.beginPath();
  ctx.moveTo(transform.x, transform.y - transform.height / 2);
  ctx.lineTo(transform.x + transform.width / 2, transform.y);
  ctx.lineTo(transform.x, transform.y + transform.height / 2);
  ctx.lineTo(transform.x - transform.width / 2, transform.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.moveTo(transform.x - transform.width * 0.75, transform.y);
  ctx.lineTo(transform.x - transform.width, transform.y + 5);
  ctx.stroke();
}

function drawPlayer(): void {
  const transform = registry.getData(player, "transform");
  if (!transform) return;

  const blink = state.playerInvulnerable > 0 && Math.floor(state.playerInvulnerable * 15) % 2 === 0;
  if (blink) return;

  if (state.shieldTimer > 0) {
    ctx.strokeStyle = "rgba(167, 139, 250, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(transform.x, transform.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#86efac";
  ctx.beginPath();
  ctx.moveTo(transform.x + 18, transform.y);
  ctx.lineTo(transform.x - 18, transform.y - 8);
  ctx.lineTo(transform.x - 8, transform.y);
  ctx.lineTo(transform.x - 18, transform.y + 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(transform.x - 3, transform.y - 2, 10, 4);
}

function drawPowerUps(): void {
  const powerUps = registry.view("powerUp", "transform");
  for (const powerUp of powerUps) {
    const transform = registry.getData(powerUp, "transform");
    const powerUpData = registry.getData(powerUp, "powerUp");
    if (!transform || !powerUpData) continue;

    ctx.fillStyle =
      powerUpData.type === "SPREAD"
        ? "#facc15"
        : powerUpData.type === "RAPID"
          ? "#38bdf8"
          : "#a78bfa";
    ctx.fillRect(transform.x - 8, transform.y - 8, 16, 16);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(powerUpData.type[0], transform.x - 3, transform.y + 4);
  }
}

function drawBullets(): void {
  const bullets = registry.view("bullet", "transform");
  for (const bullet of bullets) {
    const transform = registry.getData(bullet, "transform");
    const bulletData = registry.getData(bullet, "bullet");
    if (!transform || !bulletData) continue;

    ctx.fillStyle = bulletData.owner === "PLAYER" ? "#fde68a" : "#fb923c";
    ctx.fillRect(transform.x - 2, transform.y - 2, 4, 4);
  }
}

function renderHUD(): void {
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`SCORE ${state.score}`, 20, 30);
  ctx.fillText(`LIVES ${state.lives}`, 20, 58);
  ctx.fillText(`WAVE ${state.wave}`, 20, 86);

  const active: string[] = [];
  if (state.spreadTimer > 0) active.push("SPREAD");
  if (state.rapidTimer > 0) active.push("RAPID");
  if (state.shieldTimer > 0) active.push("SHIELD");

  ctx.font = "14px sans-serif";
  ctx.fillText(active.length ? `POWER ${active.join(" ")}` : "NO POWERUP", 20, 112);
  ctx.fillText("1942 STYLE", canvas.width - 150, 30);
}

function render(): void {
  drawBackground();
  drawBullets();
  drawPowerUps();

  const enemies = registry.view("enemy", "transform");
  for (const enemy of enemies) {
    drawEnemy(enemy);
  }

  drawPlayer();
  renderHUD();

  if (state.gameOver) {
    ctx.fillStyle = "rgba(2,6,23,0.68)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 48px sans-serif";
    ctx.fillText("GAME OVER", canvas.width / 2 - 180, canvas.height / 2 - 10);
    ctx.font = "22px sans-serif";
    ctx.fillText("Press R to restart", canvas.width / 2 - 120, canvas.height / 2 + 36);
  }
}

function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.033);
  lastFrame = now;

  if (!state.gameOver) {
    updateGame(dt);
  }

  if (state.gameOver && Input.isKeyPressed("KeyR")) {
    resetGame();
  }

  render();
  Input.endFrame();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(frame);

