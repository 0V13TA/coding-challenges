export type Vec2 = { x: number; y: number };

export type TransformComponent = {
  x: number;
  y: number;
  width: number;
  height: number;
  movementSpeed: number;
  direction: Vec2; // normalized heading, written by input/AI systems, consumed by Movement System
};

export type BulletOwner = "PLAYER" | "ENEMY";

export type BulletModifier =
  | "PIERCING"
  | "HOMING";
// add more as you go, instead of stacking booleans

export type BulletComponent = {
  lifetime: number; // Time left before self-destruction (seconds)
  attackPower: number;
  owner: BulletOwner;       // who fired it — needed by Collision System
  bulletType: "NORMAL" | "GREATER"; // replaces isGreaterBullet
  modifiers: BulletModifier[]; // usually empty
};

export type RenderComponent = {
  color: string;
};

export type HealthComponent = {
  healthPercent: number; // keep consistent: damage/attackPower should also be percent-based
};

// Timed effects — the subset of pickups that apply over time rather than instantly
export type TimedEffectType =
  | "HELPERS"
  | "PLENTY_BULLET"
  | "GREATER_BULLET"
  | "INVULNERABILITY";

export type PickUpType =
  | TimedEffectType
  | "HEARTH"      // Add 30% to player health (instant)
  | "BIG_HEARTH"; // Add 100% to player health (instant)

export type PowerUpType = "SPREAD" | "RAPID" | "SHIELD";

export type PickUpComponent = {
  type: PickUpType;
};

export type PowerUpComponent = {
  type: PowerUpType;
};

// Collecting another effect
// simply increases the timer
// and doesn't reset it.
export type EffectComponent = {
  lifetime: number;
  type: TimedEffectType;
};

export type InventoryItemType = "BOMB" | "REVIVE" | "SHIELD";

export type InventoryComponent = {
  items: Record<InventoryItemType, number>; // holds all item types at once, not just one
};

export type EnemyComponent = {
  scoreValue: number;
  type:
  | "NORMALS"     // Default Enemy Shooter
  | "RAIDERS"     // Move erratically en mass around the screen fast
  | "PURSUERS"    // Try to move to the player
  | "HEAVY_TANKS" // Have a lot of health and shoot a lot of bullets
};

export default interface ComponentRegistry {
  enemy: EnemyComponent;
  effect: EffectComponent;
  pickUp: PickUpComponent;
  powerUp: PowerUpComponent;
  bullet: BulletComponent;
  render: RenderComponent;
  health: HealthComponent;
  inventory: InventoryComponent;
  transform: TransformComponent;
}
