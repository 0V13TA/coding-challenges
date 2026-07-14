import { Registry } from "./ecs";
import "./style.css";
import {
  inputSystem,
  physicsSystem,
  screenWrapSystem,
  bulletLifetimeSystem,
  collisionSystem,
  renderSystem,
  healthSystem,
  particleSystem,
  applyScreenShake,
  triggerScreenShake,
  uiRenderSystem,
  powerUpSystem,
} from "./systems";

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.querySelector("#app")?.append(canvas);

const world = new Registry();
world.createComponent("transform");
world.createComponent("velocity");
world.createComponent("player");
world.createComponent("asteroid");
world.createComponent("bullet");
world.createComponent("collider");
world.createComponent("render");
world.createComponent("health");
world.createComponent("particle");
world.createComponent("uiContext");
world.createComponent("powerUp");

// Track keyboard state
const keys: Record<string, boolean> = {};
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));

// Persistent tracking entity index references
let globalUIEntity = world.createEntity();
world.addData(globalUIEntity, "uiContext", {
  score: 0,
  highScore: 0,
  isGameOver: false,
});

// --- Entity Spawning Closures ---

function spawnPlayer() {
  const player = world.createEntity();
  world.addData(player, "transform", {
    x: canvas.width / 2,
    y: canvas.height / 2,
    rotation: -90,
  });
  world.addData(player, "velocity", { x: 0, y: 0, angular: 0, drag: 0.98 });
  world.addData(player, "player", {
    thrustSpeed: 300,
    rotationSpeed: 240,
    fireCooldown: 0,
  });
  world.addData(player, "collider", { radius: 12, mask: "player" });
  world.addData(player, "render", { color: "#00ffcc" });
  world.addData(player, "health", { lives: 3, invulnerableTime: 2.5 });
}

function spawnPowerUp(x: number, y: number) {
  const powerUp = world.createEntity();
  const types: Array<"INVULNERABILITY" | "GREATER_BULLET" | "PLUS_1_LIFE"> = [
    "INVULNERABILITY",
    "GREATER_BULLET",
    "PLUS_1_LIFE",
  ];
  const type = types[Math.floor(Math.random() * types.length)];

  // Color mapping based on type
  const color =
    type === "PLUS_1_LIFE"
      ? "#ff3366"
      : type === "INVULNERABILITY"
        ? "#00ffcc"
        : "#ffff00";

  world.addData(powerUp, "transform", { x, y, rotation: Math.random() * 360 });
  world.addData(powerUp, "velocity", {
    x: (Math.random() - 0.5) * 50,
    y: (Math.random() - 0.5) * 50,
    angular: 45,
    drag: 1.0,
  });
  world.addData(powerUp, "powerUp", { type, lifetime: 12 }); // Disappears in 12s
  world.addData(powerUp, "collider", { radius: 8, mask: "powerUp" });
  world.addData(powerUp, "render", { color });
}

function spawnBullet(x: number, y: number, angleDeg: number) {
  const bullet = world.createEntity();
  const rad = angleDeg * (Math.PI / 180);
  const speed = 500;

  world.addData(bullet, "transform", { x, y, rotation: angleDeg });
  world.addData(bullet, "velocity", {
    x: Math.cos(rad) * speed,
    y: Math.sin(rad) * speed,
    angular: 0,
    drag: 1.0,
  });
  world.addData(bullet, "bullet", { lifetime: 1.5 });
  world.addData(bullet, "collider", { radius: 2, mask: "bullet" });
  world.addData(bullet, "render", { color: "#ffff00" });
}

export function spawnAsteroid(
  x: number,
  y: number,
  size: "large" | "medium" | "small",
) {
  const asteroid = world.createEntity();

  let radius = 40;
  let speedMultiplier = 60;
  if (size === "medium") {
    radius = 20;
    speedMultiplier = 100;
  }
  if (size === "small") {
    radius = 10;
    speedMultiplier = 150;
  }

  const angle = Math.random() * Math.PI * 2;

  world.addData(asteroid, "transform", { x, y, rotation: Math.random() * 360 });
  world.addData(asteroid, "velocity", {
    x: Math.cos(angle) * speedMultiplier,
    y: Math.sin(angle) * speedMultiplier,
    angular: (Math.random() - 0.5) * 60,
    drag: 1.0,
  });
  world.addData(asteroid, "asteroid", {
    size,
    scoreValue: size === "large" ? 20 : size === "medium" ? 50 : 100,
  });
  world.addData(asteroid, "collider", { radius, mask: "asteroid" });
  world.addData(asteroid, "render", { color: "#ffffff" });
}

function createExplosion(x: number, y: number, count: number, color: string) {
  for (let i = 0; i < count; i++) {
    const particle = world.createEntity();
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 120 + 30;
    const lifetime = Math.random() * 0.4 + 0.2;

    world.addData(particle, "transform", { x, y, rotation: 0 });
    world.addData(particle, "velocity", {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
      angular: 0,
      drag: 0.95,
    });
    world.addData(particle, "render", { color });
    world.addData(particle, "particle", { lifetime, maxLifetime: lifetime });
  }
}

function spawnThrustEngineParticles(playerEntity: number) {
  const transform = world.getData(playerEntity, "transform")!;
  const oppositeAngleRad = (transform.rotation + 180) * (Math.PI / 180);

  // Offset back exhaust nozzle placement point
  const nozzleX = transform.x + Math.cos(oppositeAngleRad) * 8;
  const nozzleY = transform.y + Math.sin(oppositeAngleRad) * 8;

  const particle = world.createEntity();
  const randomSpreadAngle = oppositeAngleRad + (Math.random() - 0.5) * 0.5;
  const speed = Math.random() * 80 + 40;
  const lifetime = Math.random() * 0.2 + 0.1;

  world.addData(particle, "transform", { x: nozzleX, y: nozzleY, rotation: 0 });
  world.addData(particle, "velocity", {
    x: Math.cos(randomSpreadAngle) * speed,
    y: Math.sin(randomSpreadAngle) * speed,
    angular: 0,
    drag: 0.96,
  });
  world.addData(particle, "render", {
    color: Math.random() > 0.5 ? "#ff3300" : "#ffaa00",
  });
  world.addData(particle, "particle", { lifetime, maxLifetime: lifetime });
}

function resetGame() {
  // Wipe all actors inside active views
  const dynamicEntities = world.view("collider");
  for (const ent of dynamicEntities) world.destroyEntity(ent);

  const particleEntities = world.view("particle");
  for (const ent of particleEntities) world.destroyEntity(ent);

  const ui = world.getData(globalUIEntity, "uiContext")!;
  ui.score = 0;
  ui.isGameOver = false;

  spawnPlayer();
  for (let i = 0; i < 5; i++) {
    spawnAsteroid(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      "large",
    );
  }
}

// Initial Population Layout
resetGame();

// --- Execution Loop ---
let lastTime = 0;

function animate(currentTime: number) {
  if (!lastTime) lastTime = currentTime;
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const ui = world.getData(globalUIEntity, "uiContext")!;

  if (ui.isGameOver) {
    if (keys["r"] || keys["R"]) resetGame();
    uiRenderSystem(ctx, world);
    requestAnimationFrame(animate);
    return;
  }

  // 1. Process Updates & Dynamic Input Systems
  inputSystem(world, keys, dt, spawnBullet);

  // Visual finesse: spawn jet exhaust sparks if thrust vectors are being injected
  const players = world.view("player");
  if (players.length > 0 && (keys["ArrowUp"] || keys["w"])) {
    spawnThrustEngineParticles(players[0]);
  }

  physicsSystem(world, dt);
  screenWrapSystem(world, canvas.width, canvas.height);
  bulletLifetimeSystem(world, dt);
  healthSystem(world, dt);
  particleSystem(world, dt);
  powerUpSystem(world, dt);

  // 2. Process Game Rules / Collisions
  collisionSystem(
    world,
    (asteroid, bullet) => {
      const astData = world.getData(asteroid, "asteroid")!;
      const pos = world.getData(asteroid, "transform")!;

      // Accumulate score metrics
      ui.score += astData.scoreValue;
      if (ui.score > ui.highScore) ui.highScore = ui.score;

      triggerScreenShake(
        astData.size === "large" ? 6 : astData.size === "medium" ? 4 : 2,
      );

      createExplosion(
        pos.x,
        pos.y,
        astData.size === "large" ? 20 : astData.size === "medium" ? 12 : 6,
        "#ffffff",
      );

      // Handle Splitting Logic
      if (astData.size === "large") {
        spawnAsteroid(pos.x, pos.y, "medium");
        spawnAsteroid(pos.x, pos.y, "medium");

        // Add a 20% chance to drop a power-up from large asteroids
        if (Math.random() < 1.0) spawnPowerUp(pos.x, pos.y);
      } else if (astData.size === "medium") {
        spawnAsteroid(pos.x, pos.y, "small");
        spawnAsteroid(pos.x, pos.y, "small");

        // Add a 10% chance to drop a power-up from large asteroids
        if (Math.random() < 1.0) spawnPowerUp(pos.x, pos.y);
      }

      world.destroyEntity(asteroid);
      world.destroyEntity(bullet);
    },
    (player) => {
      const health = world.getData(player, "health");
      if (!health || health.invulnerableTime > 0) return;

      health.lives--;
      const pos = world.getData(player, "transform")!;

      triggerScreenShake(15);
      createExplosion(pos.x, pos.y, 40, "#00ffcc");

      if (health.lives <= 0) {
        ui.isGameOver = true;
        world.destroyEntity(player);
      } else {
        const velocity = world.getData(player, "velocity")!;
        velocity.x = 0;
        velocity.y = 0;
        velocity.angular = 0;

        health.invulnerableTime = 2.0;
      }
    },
    (player, powerUp) => {
      const pData = world.getData(powerUp, "powerUp")!;
      const playerComp = world.getData(player, "player")!;
      const healthComp = world.getData(player, "health")!;
      const pos = world.getData(powerUp, "transform")!;

      if (pData.type === "PLUS_1_LIFE") {
        healthComp.lives++;
      } else if (pData.type === "INVULNERABILITY") {
        healthComp.invulnerableTime = 5.0; // 5 seconds of shield
      } else if (pData.type === "GREATER_BULLET") {
        playerComp.hasGreaterBullet = true;
        playerComp.greaterBulletTimer = 10.0; // 10 seconds of multi-shot
      }

      // Visual feedback
      createExplosion(pos.x, pos.y, 15, "#00ffcc");
      world.destroyEntity(powerUp);
    },
  );

  // 3. Render Pipeline Stack Execution
  ctx.save();
  applyScreenShake(ctx, dt);

  renderSystem(world, (x, y, rotation, radius, mask, color, alpha) => {
    const activePlayers = world.view("player", "health");
    if (mask === "player" && activePlayers.length > 0) {
      const hData = world.getData(activePlayers[0], "health");
      if (
        hData &&
        hData.invulnerableTime > 0 &&
        Math.floor(currentTime / 100) % 2 === 0
      ) {
        return;
      }
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * (Math.PI / 180));

    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (mask === "player") {
      ctx.moveTo(15, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.stroke();

      // 2. Draw Invulnerability Shield Forcefield
      const activePlayers = world.view("player", "health");
      if (activePlayers.length > 0) {
        const hData = world.getData(activePlayers[0], "health");
        if (hData && hData.invulnerableTime > 0) {
          ctx.beginPath();

          // Calculate a smooth pulsing effect between 0.3 and 0.8 alpha
          const pulse = Math.abs(Math.sin(currentTime / 150));
          const shieldAlpha = 0.3 + pulse * 0.5;

          ctx.strokeStyle = `rgba(0, 255, 204, ${shieldAlpha})`;
          ctx.lineWidth = 2;

          // Draw a circle slightly larger than the ship's collision radius
          ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
          ctx.stroke();

          // Add a faint translucent fill to make it pop
          ctx.fillStyle = `rgba(0, 255, 204, ${shieldAlpha * 0.2})`;
          ctx.fill();
        }
      }
    } else if (mask === "particle") {
      ctx.fillStyle = color;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    } else {
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  });

  ctx.restore(); // Clear screen shake transformation matrices

  // 4. Draw Overlay Text Hud
  uiRenderSystem(ctx, world);

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
