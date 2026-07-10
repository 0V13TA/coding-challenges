import { Registry } from "./ecs";
import "./style.css";
import { drawWarpped } from "./systems";

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

canvas.width = innerWidth * 0.99;
canvas.height = innerHeight * 0.99;
let animation: number, lastTime: number;

document.querySelector("#app")?.append(canvas);

const world = new Registry();
world.createComponent("transform");
world.createComponent("render");

// Setup the play space boundaries based on canvas viewport

// Creating a moving object that wraps
const projectile = world.createEntity();
world.addData(projectile, "transform", { x: 10, y: 50, dir: 0, canWarp: true });
world.addData(projectile, "render", { radius: 10, color: "#a4f" });
const transform = world.getData(projectile, "transform");
const render = world.getData(projectile, "render");

function animate(currentTime: number) {
  if (!lastTime) lastTime = currentTime;
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (transform && render) {
    transform.x += 10;
    transform.x = (transform.x + canvas.width) % canvas.width;
    transform.y = (transform.y + canvas.height) % canvas.height;
  }

  drawWarpped(ctx, world, (x, y, radius, color) => {
    ctx.save();

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    // ctx.fillRect(x, y, radius, radius);
    ctx.fill();

    ctx.restore();
  });

  animation = requestAnimationFrame(animate);
}

animation = requestAnimationFrame(animate);
