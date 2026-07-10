import type { Registry } from "./ecs";

export function drawWarpped(
  ctx: CanvasRenderingContext2D,
  world: Registry,
  drawFn: (x: number, y: number, radius: number, color: string) => void,
) {
  const canvas = ctx.canvas;
  const offsets = [
    [0, 0],
    [canvas.width, 0],
    [-canvas.width, 0],
    [0, canvas.height],
    [0, -canvas.height],
    [canvas.width, canvas.height],
    [-canvas.width, -canvas.height],
    [canvas.width, -canvas.height],
    [-canvas.width, canvas.height],
  ];

  const entities = world.view("transform", "render");

  for (const entity of entities) {
    const transform = world.getData(entity, "transform");
    const render = world.getData(entity, "render");
    if (!transform || !render || !transform.canWarp) continue;

    const obj = { ...transform, ...render };
    for (const [dx, dy] of offsets) {
      const x = obj.x + dx;
      const y = obj.y + dy;

      if (
        x > -obj.radius &&
        x < canvas.width + obj.radius &&
        y > -obj.radius &&
        y < canvas.height + obj.radius
      ) {
        drawFn(x, y, obj.radius, obj.color);
      }
    }
  }
}
