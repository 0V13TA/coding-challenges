import type { Entity, Registry } from "./ecs";

/**
 * 1. INPUT SYSTEM
 * Listens to active keys to apply thrust and rotation to the player entity,
 * and handles bullet spawning with a fire cooldown.
 */
export function inputSystem(
  world: Registry,
  keys: Record<string, boolean>,
  dt: number,
  spawnBullet: (x: number, y: number, angleDeg: number) => void,
) {
  const players = world.view("player", "transform", "velocity");

  for (let i = 0; i < players.length; i++) {
    const entity = players[i];
    const player = world.getData(entity, "player")!;
    const transform = world.getData(entity, "transform")!;
    const velocity = world.getData(entity, "velocity")!;

    // 1. Handle Firing Cooldown
    if (player.fireCooldown > 0) {
      player.fireCooldown -= dt;
    }

    // 2. Handle Rotation (Left / Right)
    let rotationDir = 0;
    if (keys["ArrowLeft"] || keys["a"]) rotationDir -= 1;
    if (keys["ArrowRight"] || keys["d"]) rotationDir += 1;
    velocity.angular = rotationDir * player.rotationSpeed;

    // 3. Handle Thrust (Up)
    if (keys["ArrowUp"] || keys["w"]) {
      // Convert degrees to radians for trigonometry
      const rad = transform.rotation * (Math.PI / 180);
      velocity.x += Math.cos(rad) * player.thrustSpeed * dt;
      velocity.y += Math.sin(rad) * player.thrustSpeed * dt;
    }

    // 4. Handle Shooting (Space)
    if ((keys[" "] || keys["Spacebar"]) && player.fireCooldown <= 0) {
      // Spawn bullet slightly ahead of the ship's nose
      const rad = transform.rotation * (Math.PI / 180);
      const noseX = transform.x + Math.cos(rad) * 15;
      const noseY = transform.y + Math.sin(rad) * 15;

      spawnBullet(noseX, noseY, transform.rotation);
      player.fireCooldown = 0.25; // 250ms delay between shots
    }
  }
}

/**
 * 2. PHYSICS SYSTEM
 * Updates positions based on velocity vectors, updates orientation angles,
 * and applies structural drag to slow down linear gliding over time.
 */
export function physicsSystem(world: Registry, dt: number) {
  const entities = world.view("transform", "velocity");

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const transform = world.getData(entity, "transform")!;
    const velocity = world.getData(entity, "velocity")!;

    // Update coordinates
    transform.x += velocity.x * dt;
    transform.y += velocity.y * dt;

    // Update orientation angle
    transform.rotation += velocity.angular * dt;

    // Apply linear drag friction (primarily affects the player's ship)
    velocity.x *= Math.pow(velocity.drag, dt * 60);
    velocity.y *= Math.pow(velocity.drag, dt * 60);
  }
}

/**
 * 3. SCREEN WRAP SYSTEM
 * Ensures entities smoothly wrap around edges using their bounding collider radius.
 */
export function screenWrapSystem(
  world: Registry,
  width: number,
  height: number,
) {
  const entities = world.view("transform", "collider");

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const transform = world.getData(entity, "transform")!;
    const collider = world.getData(entity, "collider")!;
    const r = collider.radius;

    if (transform.x < -r) transform.x = width + r;
    else if (transform.x > width + r) transform.x = -r;

    if (transform.y < -r) transform.y = height + r;
    else if (transform.y > height + r) transform.y = -r;
  }
}

/**
 * 4. BULLET LIFETIME SYSTEM
 * Decrements the active lifespan of bullets and removes them when expired.
 */
export function bulletLifetimeSystem(world: Registry, dt: number) {
  const bullets = world.view("bullet");

  for (let i = 0; i < bullets.length; i++) {
    const entity = bullets[i];
    const bullet = world.getData(entity, "bullet")!;
    bullet.lifetime -= dt;

    if (bullet.lifetime <= 0) {
      world.destroyEntity(entity);
    }
  }
}

/**
 * 5. COLLISION SYSTEM
 * Runs a flat, low-overhead double loop to check distances between bounding circles.
 * Handles Bullet -> Asteroid and Asteroid -> Player interactions.
 */
export function collisionSystem(
  world: Registry,
  onAsteroidHit: (asteroidEntity: Entity, bulletEntity: Entity) => void,
  onPlayerHit: (playerEntity: Entity) => void,
) {
  const entities = world.view("transform", "collider");
  const len = entities.length;

  for (let i = 0; i < len; i++) {
    const e1 = entities[i];
    const t1 = world.getData(e1, "transform");
    const c1 = world.getData(e1, "collider");

    if (!t1 || !c1) continue;

    for (let j = i + 1; j < len; j++) {
      const e2 = entities[j];
      const t2 = world.getData(e2, "transform");
      const c2 = world.getData(e2, "collider");

      if (!t2 || !c2) continue;

      // Skip pairs that share masks (Asteroid vs Asteroid, Bullet vs Bullet)
      if (c1.mask === c2.mask) continue;

      // Circle distance evaluation
      const dx = t1.x - t2.x;
      const dy = t1.y - t2.y;
      const distSq = dx * dx + dy * dy;
      const radiusSum = c1.radius + c2.radius;

      if (distSq < radiusSum * radiusSum) {
        // 1. Bullet vs Asteroid
        if (c1.mask === "asteroid" && c2.mask === "bullet") {
          onAsteroidHit(e1, e2);
          break;
        } else if (c1.mask === "bullet" && c2.mask === "asteroid") {
          onAsteroidHit(e2, e1);
          break;
        }

        // 2. Player vs Asteroid (Handles both execution order possibilities)
        else if (c1.mask === "asteroid" && c2.mask === "player") {
          onPlayerHit(e2);
          break;
        } else if (c1.mask === "player" && c2.mask === "asteroid") {
          onPlayerHit(e1);
          // Break the inner loop since the player was hit and moved/updated
          break;
        }
      }
    }
  }
}

/**
 * 6. RENDER SYSTEM
 * Updated to query either colliders OR particles so everything renders uniformly,
 * passing an optional alpha parameter down to the drawing hook.
 */
export function renderSystem(
  world: Registry,
  drawFn: (
    x: number,
    y: number,
    rotationDeg: number,
    radius: number,
    mask: string,
    color: string,
    alpha: number,
  ) => void,
) {
  // 1. Render gameplay entities with colliders
  const collidables = world.view("transform", "collider", "render");
  for (let i = 0; i < collidables.length; i++) {
    const entity = collidables[i];
    const transform = world.getData(entity, "transform")!;
    const collider = world.getData(entity, "collider")!;
    const render = world.getData(entity, "render")!;

    drawFn(
      transform.x,
      transform.y,
      transform.rotation,
      collider.radius,
      collider.mask,
      render.color,
      1.0,
    );
  }

  // 2. Render visual particles (fading them out over time)
  const particles = world.view("transform", "particle", "render");
  for (let i = 0; i < particles.length; i++) {
    const entity = particles[i];
    const transform = world.getData(entity, "transform")!;
    const particle = world.getData(entity, "particle")!;
    const render = world.getData(entity, "render")!;

    const alpha = Math.max(0, particle.lifetime / particle.maxLifetime);
    drawFn(
      transform.x,
      transform.y,
      transform.rotation,
      1.5,
      "particle",
      render.color,
      alpha,
    );
  }
}

/**
 * 7. HEALTH SYSTEM
 * Decrements active invulnerability frames over time.
 */
export function healthSystem(world: Registry, dt: number) {
  const entities = world.view("health");

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const health = world.getData(entity, "health")!;
    if (health.invulnerableTime > 0) {
      health.invulnerableTime -= dt;
    }
  }
}

/**
 * 8. PARTICLE SYSTEM
 * Updates lifetime for visual effects particles and culls them when dead.
 */
export function particleSystem(world: Registry, dt: number) {
  const particles = world.view("particle");

  for (let i = 0; i < particles.length; i++) {
    const entity = particles[i];
    const particle = world.getData(entity, "particle")!;
    particle.lifetime -= dt;

    if (particle.lifetime <= 0) {
      world.destroyEntity(entity);
    }
  }
}

// Keep a fast local state pointer for screen shake decay transformations
let shakeIntensity = 0;

export function triggerScreenShake(magnitude: number) {
  shakeIntensity = Math.max(shakeIntensity, magnitude);
}

/**
 * 9. SCREEN SHAKE MODULE
 * Mutates the canvas translation matrix prior to core render calls.
 */
export function applyScreenShake(ctx: CanvasRenderingContext2D, dt: number) {
  if (shakeIntensity > 0) {
    const dx = (Math.random() - 0.5) * shakeIntensity;
    const dy = (Math.random() - 0.5) * shakeIntensity;
    ctx.translate(dx, dy);

    // Exponential decay towards stabilization
    shakeIntensity *= Math.pow(0.9, dt * 60);
    if (shakeIntensity < 0.1) shakeIntensity = 0;
  }
}

/**
 * 10. UI & GAME OVER HUD SYSTEM
 * Handles rendering text alignments without messing up local canvas translations.
 */
export function uiRenderSystem(ctx: CanvasRenderingContext2D, world: Registry) {
  const uiEntities = world.view("uiContext");
  if (uiEntities.length === 0) return;

  const ui = world.getData(uiEntities[0], "uiContext")!;
  const playerEntities = world.view("player", "health");

  // 1. Draw Active HUD Score Meter
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE: ${ui.score}`, 25, 40);
  ctx.fillText(`High Score: ${ui.highScore}`, 25, 65);

  // 2. Draw Vector Shields/Lives Display
  if (playerEntities.length > 0) {
    const health = world.getData(playerEntities[0], "health")!;
    ctx.textAlign = "right";
    ctx.fillText(
      "▲ ".repeat(Math.max(0, health.lives)),
      ctx.canvas.width - 25,
      40,
    );
  }
  ctx.restore();

  // 3. Game Over Structural Modal Overlay
  if (ui.isGameOver) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = "#ff3366";
    ctx.font = "bold 50px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", ctx.canvas.width / 2, ctx.canvas.height / 2 - 20);

    ctx.fillStyle = "#00ffcc";
    ctx.font = "18px monospace";
    ctx.fillText(
      "PRESS 'R' TO RESTART STATION",
      ctx.canvas.width / 2,
      ctx.canvas.height / 2 + 30,
    );
    ctx.restore();
  }
}
