import { renderEditor, handleCommand } from "./editor";
import "./style.css";
const canvas = document.getElementById("graphics-canvas") as HTMLCanvasElement;
if (!canvas) {
  throw new Error("Canvas element not found");
}
const ctx = canvas.getContext("2d");

const inputForm = document.getElementById("input-form") as HTMLFormElement;
const inputElement = document.getElementById("input") as HTMLInputElement;
const commandsContainer = document.getElementById(
  "commands-container",
) as HTMLElement;
const programMap = new Map<number, string>();

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (ctx) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Initialize on load

if (inputForm && inputElement && commandsContainer) {
  inputForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const rawInput = inputElement.value.trim();
    if (!rawInput) return;

    const lineNumber = handleCommand(rawInput, programMap);
    inputElement.value = `${lineNumber !== undefined ? lineNumber + 10 : ""} `;
    renderEditor(programMap, commandsContainer);
  });
}
