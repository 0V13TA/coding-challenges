import "./style.css";
import { loadShaders } from "./webgl";
const canvas = document.createElement("canvas");
const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
document.querySelector("#app")?.append(canvas);

// prettier-ignore
const vertices = new Float32Array([
  -0.5, -0.5, 0.0,
   0.5, -0.5, 0.0,
   0.0,  0.5, 0.0
]);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

gl.vertexAttribPointer(
  0,
  3,
  gl.FLOAT,
  false,
  3 * Float32Array.BYTES_PER_ELEMENT,
  0,
);
gl.enableVertexAttribArray(0);

const program = loadShaders(
  gl,
  `#version 300 es

layout(location = 0) in vec3 aPos;

void main() {
  gl_Position = vec4(aPos, 1.0);
}`,
  `#version 300 es
precision mediump float;

out vec4 FragColor;

void main() {
  FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f);
}`,
);
gl.useProgram(program);

// --- Execution Loop ---
let lastTime = 0;

function animate(currentTime: number) {
  if (!lastTime) lastTime = currentTime;
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  gl.clearColor(0.0, 0.0, 0.5, 1.0);
  gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
