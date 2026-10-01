import type { Entity, Registry } from "./ecs";
import { Input } from "./utils";

export type EnemyKind =
  | "NORMALS"
  | "RAIDERS"
  | "PURSUERS"
  | "HEAVY_TANKS";

export type PowerUpKind = "SPREAD" | "RAPID" | "SHIELD";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalize(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function createPlayer(registry: Registry, x: number, y: number): Entity {
  const entity = registry.createEntity();

  registry.addData(entity, "transform", {
    x,
    y,
    width: 28,
    height: 20,
    movementSpeed: 380,
    direction: { x: 1, y: 0 },
  });
  registry.addData(entity, "render", { color: "#a7f3d0" });
  registry.addData(entity, "health", { healthPercent: 100 });

  return entity;
}

export function createEnemy(
  registry: Registry,
  x: number,
  y: number,
  type: EnemyKind,
): Entity {
  const enemy = registry.createEntity();
  const profile = {
    NORMALS: { speed: 160, health: 32, width: 26, height: 20, score: 120, color: "#fca5a5" },
    RAIDERS: { speed: 180, health: 28, width: 24, height: 18, score: 150, color: "#f9a8d4" },
    PURSUERS: { speed: 140, health: 42, width: 30, height: 22, score: 180, color: "#fbbf24" },
    HEAVY_TANKS: { speed: 90, health: 70, width: 34, height: 26, score: 260, color: "#a78bfa" },
  }[type];

  registry.addData(enemy, "enemy", {
    scoreValue: profile.score,
    type,
  });
  registry.addData(enemy, "transform", {
    x,
    y,
    width: profile.width,
    height: profile.height,
    movementSpeed: profile.speed,
    direction: { x: -1, y: 0 },
  });
  registry.addData(enemy, "health", { healthPercent: profile.health });
  registry.addData(enemy, "render", { color: profile.color });

  return enemy;
}

export function createBullet(
  registry: Registry,
  owner: "PLAYER" | "ENEMY",
  x: number,
  y: number,
  direction: { x: number; y: number },
  speed: number,
  power: number,
): Entity {
  const bullet = registry.createEntity();
  const normalized = normalize(direction.x, direction.y);

  registry.addData(bullet, "bullet", {
    lifetime: 3,
    attackPower: power,
    owner,
    bulletType: "NORMAL",
    modifiers: [],
  });
  registry.addData(bullet, "transform", {
    x,
    y,
    width: owner === "PLAYER" ? 8 : 10,
    height: owner === "PLAYER" ? 8 : 10,
    movementSpeed: speed,
    direction: normalized,
  });
  registry.addData(bullet, "render", {
    color: owner === "PLAYER" ? "#fef08a" : "#fb923c",
  });

  return bullet;
}

export function updatePlayerController(registry: Registry, player: Entity, dt: number): void {
  const transform = registry.getData(player, "transform");
  if (!transform) return;

  const moveX =
    Number(Input.isKeyHeld("KeyD") || Input.isKeyHeld("ArrowRight")) -
    Number(Input.isKeyHeld("KeyA") || Input.isKeyHeld("ArrowLeft"));
  const moveY =
    Number(Input.isKeyHeld("KeyS") || Input.isKeyHeld("ArrowDown")) -
    Number(Input.isKeyHeld("KeyW") || Input.isKeyHeld("ArrowUp"));

  if (moveX !== 0 || moveY !== 0) {
    const movement = normalize(moveX, moveY);
    transform.x += movement.x * transform.movementSpeed * dt;
    transform.y += movement.y * transform.movementSpeed * dt;
  }

  transform.direction = { x: 1, y: 0 };
}

export function firePlayerShot(
  registry: Registry,
  player: Entity,
  spread: boolean = false,
): void {
  const transform = registry.getData(player, "transform");
  if (!transform) return;

  const base = {
    x: 1,
    y: 0,
  };

  createBullet(
    registry,
    "PLAYER",
    transform.x + 18,
    transform.y,
    base,
    650,
    24,
  );

  if (spread) {
    createBullet(
      registry,
      "PLAYER",
      transform.x + 18,
      transform.y - 8,
      { x: 1, y: -0.35 },
      620,
      20,
    );
    createBullet(
      registry,
      "PLAYER",
      transform.x + 18,
      transform.y + 8,
      { x: 1, y: 0.35 },
      620,
      20,
    );
  }
}

export function fireEnemyShot(registry: Registry, enemy: Entity, player: Entity): void {
  const enemyTransform = registry.getData(enemy, "transform");
  const playerTransform = registry.getData(player, "transform");
  if (!enemyTransform || !playerTransform) return;

  const dir = normalize(
    playerTransform.x - enemyTransform.x,
    playerTransform.y - enemyTransform.y,
  );

  createBullet(
    registry,
    "ENEMY",
    enemyTransform.x - 10,
    enemyTransform.y,
    dir,
    320,
    18,
  );
}

export function applyDamage(registry: Registry, entity: Entity, amount: number): boolean {
  const health = registry.getData(entity, "health");
  if (!health) return false;

  health.healthPercent = Math.max(0, health.healthPercent - amount);
  return health.healthPercent <= 0;
}

export function updateBullets(registry: Registry, dt: number): void {
  const bullets = registry.view("bullet", "transform");

  for (const bullet of bullets) {
    const bulletData = registry.getData(bullet, "bullet");
    const transform = registry.getData(bullet, "transform");
    if (!bulletData || !transform) continue;

    transform.x += transform.direction.x * transform.movementSpeed * dt;
    transform.y += transform.direction.y * transform.movementSpeed * dt;
    bulletData.lifetime -= dt;

    if (
      bulletData.lifetime <= 0 ||
      transform.x < -40 ||
      transform.x > window.innerWidth + 40 ||
      transform.y < -40 ||
      transform.y > window.innerHeight + 40
    ) {
      registry.destroyEntity(bullet);
    }
  }
}

export function createPowerUp(
  registry: Registry,
  x: number,
  y: number,
  type: PowerUpKind,
): Entity {
  const entity = registry.createEntity();
  const colorMap: Record<PowerUpKind, string> = {
    SPREAD: "#facc15",
    RAPID: "#38bdf8",
    SHIELD: "#a78bfa",
  };

  registry.addData(entity, "powerUp", { type });
  registry.addData(entity, "transform", {
    x,
    y,
    width: 18,
    height: 18,
    movementSpeed: 0,
    direction: { x: 0, y: 1 },
  });
  registry.addData(entity, "render", { color: colorMap[type] });

  return entity;
}

export function updateEnemies(
  registry: Registry,
  player: Entity,
  dt: number,
  elapsed: number,
): void {
  const enemies = registry.view("enemy", "transform");

  for (const enemy of enemies) {
    const enemyTransform = registry.getData(enemy, "transform");
    const enemyData = registry.getData(enemy, "enemy");
    if (!enemyTransform || !enemyData) continue;

    const playerTransform = registry.getData(player, "transform");
    if (!playerTransform) continue;

    if (enemyData.type === "RAIDERS") {
      enemyTransform.x -= enemyTransform.movementSpeed * dt;
      enemyTransform.y += Math.sin(elapsed * 4 + enemyTransform.x * 0.1) * 90 * dt;
    } else if (enemyData.type === "HEAVY_TANKS") {
      enemyTransform.x -= enemyTransform.movementSpeed * dt * 0.75;
      enemyTransform.y += Math.sin(elapsed * 2 + enemyTransform.x * 0.03) * 40 * dt;
    } else if (enemyData.type === "PURSUERS") {
      const dx = playerTransform.x - enemyTransform.x;
      const dy = playerTransform.y - enemyTransform.y;
      const dir = normalize(dx, dy);
      enemyTransform.x += dir.x * enemyTransform.movementSpeed * dt * 0.8;
      enemyTransform.y += dir.y * enemyTransform.movementSpeed * dt * 0.8;
    } else {
      enemyTransform.x -= enemyTransform.movementSpeed * dt;
    }

    if (Math.random() < dt * (enemyData.type === "HEAVY_TANKS" ? 0.9 : 0.45)) {
      fireEnemyShot(registry, enemy, player);
    }
  }
}

