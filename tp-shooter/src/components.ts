export type TransformComponent = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BulletComponent = {
  lifetime: number; // Time left before self-destruction (seconds)
  attackPower: number;
  isGreaterBullet: boolean;
};

export type RenderComponent = {
  color: string;
};

export type HealthComponent = {
  healthPercent: number;
};

export type PickUpComponent = {
  type:
  | "HELPERS"         // Summons other shooters to help you
  | "HEARTH"          // Add 30% to player health
  | "BIG_HEARTH"      // Add 100% to player health
  | "PLENTY_BULLET"   // Shootes multiple bullets at once
  | "GREATER_BULLET"  // Shootes bullets with greater power
  | "INVULNERABILITY" // Makes you immune to attacks
};

// Collecting another effect
// simply increases the timer
// and doesn't reset it.
export type EffectComponent = {
  lifetime: number;
  type:
  | "HELPERS"
  | "PLENTY_BULLET"
  | "GREATER_BULLET"
  | "INVULNERABILITY"
}

export type InventoryComponent = {
  quantity: number;
  type:
  | "BOMB"   // Destroys all enemies on screen
  | "REVIVE" // Revives the player once
  | "SHIELD" // Activates INVULNERABILITY
}

export type PlayerComponent = {
  movementSpeed: number;
}

export type EnemyComponent = {
  scoreValue: number;
  type:
  | "NORMALS"     // Default Enemy Shooter
  | "RAIDERS"     // Move erratically en mass around the screen fast
  | "PURSUERS"    // Try to move to the player
  | "HEAVY_TANKS" // Have a lot of health and shoot a lot of bullets
}

export default interface ComponentRegistry {
  enemy: EnemyComponent;
  effect: EffectComponent;
  pickUp: PickUpComponent;
  bullet: BulletComponent;
  render: RenderComponent;
  health: HealthComponent;
  inventory: InventoryComponent;
  transform: TransformComponent;
}

