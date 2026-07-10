import "./style.css";
import { loadShaders } from "./webgl";
import vertexShaderSource from "./assets/shader.vert";
import fragmentShaderSource from "./assets/shader.frag";
import * as glm from "gl-matrix";

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

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

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
gl.bindBuffer(gl.ARRAY_BUFFER, null);
gl.bindVertexArray(null);

const program = loadShaders(gl, vertexShaderSource, fragmentShaderSource)!;
gl.useProgram(program);

const viewMatrixUniformLocation = gl.getUniformLocation(program, "mView");
const worldMatrixUniformLocation = gl.getUniformLocation(program, "mWorld");
const projMatrixUniformLocation = gl.getUniformLocation(program, "mProjection");

let worldMatrix = new Float32Array(16),
  viewMatrix = new Float32Array(16),
  projectionMatrix = new Float32Array(16);

glm.mat4.identity(worldMatrix);
glm.mat4.lookAt(viewMatrix, [0, 0, -2], [0, 0, 0], [0, 1, 0]);
glm.mat4.perspective(
  projectionMatrix,
  glm.glMatrix.toRadian(45),
  canvas.width / canvas.height,
  0.1,
  1000,
);

gl.uniformMatrix4fv(viewMatrixUniformLocation, false, viewMatrix);
gl.uniformMatrix4fv(worldMatrixUniformLocation, false, worldMatrix);
gl.uniformMatrix4fv(projMatrixUniformLocation, false, projectionMatrix);

// gl.enable(gl.CULL_FACE);
// gl.cullFace(gl.BACK);

// --- Execution Loop ---
let lastTime = 0;
let angle = 0;

let identityMatrix = new Float32Array(16);
glm.mat4.identity(identityMatrix);

function animate(currentTime: number) {
  if (!lastTime) lastTime = currentTime;
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  gl.clearColor(0.0, 0.0, 0.5, 1.0);
  gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

  gl.bindVertexArray(vao);

  angle += (dt / 6) * 2 * Math.PI;

  glm.mat4.rotate(worldMatrix, identityMatrix, angle, [0, 1, 0]);
  gl.uniformMatrix4fv(worldMatrixUniformLocation, false, worldMatrix);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
