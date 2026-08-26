import { Ball } from "./objects/ball";
import { Block } from "./objects/block";
import { Paddle } from "./objects/paddle";
import { Shooter } from "./objects/shooter";
import { UniqueStatusDrop } from "./objects/uniqueStatus";

export function checkCollisionCircleRec(
  rect: Paddle | Shooter | Block,
  circle: Ball | UniqueStatusDrop,
): boolean {
  let collision = false;
  let recCenterX = rect.x + rect.width / 2,
    recCenterY = rect.y + rect.height / 2;
  let dx = Math.abs(circle.x - recCenterX),
    dy = Math.abs(circle.y - recCenterY);

  if (dx > rect.width / 2 + circle.radius) return false;
  if (dy > rect.height / 2 + circle.radius) return false;

  if (dx <= rect.width / 2) return true;
  if (dy <= rect.height / 2) return true;

  const cornerDistanceSquare =
    Math.pow(dx - rect.width / 2, 2) + Math.pow(dy - rect.height / 2, 2);

  collision = cornerDistanceSquare <= circle.radius * circle.radius;
  return collision;
}

export function handlePaddleCollisionSKill(ball: Ball, paddle: Paddle) {
  // 1. Calculate relative intersect point
  // Center of paddle = paddle.x + paddle.width/2
  let paddleCenter = paddle.x + paddle.width / 2;

  // Distance between ball and paddle center
  let dist = ball.x - paddleCenter;

  // 2. Normalize this distance (-1 to 1)
  // We divide by half the width.
  // Result: -1 (far left edge), 0 (center), 1 (far right edge)
  let normalizeIntersect = dist / (paddle.width / 2);

  // 3. Calculate bounce angle
  // Max angle = 60 degrees (converted to radians)
  let maxBounceAngle = (60 * Math.PI) / 180;
  let bounceAngle = normalizeIntersect * maxBounceAngle;

  // 4. Update Ball Velocity
  // We keep the SAME speed, but change direction.
  // Math.sin gives us the X component (moving sideways)
  // Math.cos gives us the Y component (moving up/down)
  // We negate Math.cos because Y goes UP (negative) in canvas.
  ball.dx = ball.speed * Math.sin(bounceAngle);
  ball.dy = -ball.speed * Math.cos(bounceAngle);
}

export function getCollisionDirection(
  ball: Ball,
  block: Block,
): "horizontal" | "vertical" | null {
  // 1. Find closest point on the block to the circle center
  //Clamp circle center to the rectangle's bounds
  let closeX = Math.max(block.x, Math.min(ball.x, block.x + block.width));
  let closeY = Math.max(block.y, Math.min(ball.y, block.y + block.height));

  // 2. Calculate distance from circle center to this closest point
  let distanceX = ball.x - closeX;
  let distanceY = ball.y - closeY;
  let distanceSquared = distanceX * distanceX + distanceY * distanceY;

  // 3. Check collision
  // Use radius squared for performance (avoids sqrt)
  // Note: Since x/y are 0-1 normalized, radius must be consistent.
  // Ideally ensure ball.radius is in same coordinate space (0-1).
  if (distanceSquared > ball.radius * ball.radius) {
    return null;
  }

  // 4. Determine Side
  // If the distance in X is greater, we hit the Left/Right sides.
  // If distance in Y is greater, we hit Top/Bottom.
  // We add a tiny buffer (epsilon) to prevent corner glitches
  if (Math.abs(distanceX) > Math.abs(distanceY)) {
    return "horizontal"; // Hit left or right
  } else {
    return "vertical"; // Hit top or bottom
  }
}
