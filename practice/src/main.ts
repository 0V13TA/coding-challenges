import "./style.css";
import { loadShaders, loadTextureAsync } from "./webgl";
import vertexShaderSource from "./assets/shader.vert";
import fragmentShaderSource from "./assets/shader.frag";
import * as glm from "gl-matrix";

const canvas = document.createElement("canvas");
const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
document.querySelector("#app")?.append(canvas);

onresize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);

  glm.mat4.perspective(
    projectionMatrix,
    glm.glMatrix.toRadian(45),
    canvas.width / canvas.height,
    0.1,
    1000,
  );
  gl.uniformMatrix4fv(projMatrixUniformLocation, false, projectionMatrix);
};

/**
 * Interleaved Vertex Data:
 * [X, Y, Z,   R, G, B]
 */
// prettier-ignore
export const cubeVertices = new Float32Array([
  // Front face corners
  -0.5, -0.5,  0.5,    1.0, 0.0, 0.0, // 0: Bottom-left  (Red)
   0.5, -0.5,  0.5,    0.0, 1.0, 0.0, // 1: Bottom-right (Green)
   0.5,  0.5,  0.5,    0.0, 0.0, 1.0, // 2: Top-right    (Blue)
  -0.5,  0.5,  0.5,    1.0, 1.0, 0.0, // 3: Top-left     (Yellow)

  // Back face corners
  -0.5, -0.5, -0.5,    1.0, 0.0, 1.0, // 4: Bottom-left  (Magenta)
   0.5, -0.5, -0.5,    0.0, 1.0, 1.0, // 5: Bottom-right (Cyan)
   0.5,  0.5, -0.5,    1.0, 1.0, 1.0, // 6: Top-right    (White)
  -0.5,  0.5, -0.5,    0.0, 0.0, 0.0, // 7: Top-left     (Black)
]);

/**
 * Indices mapping the 8 vertices to 12 triangles (36 indices total).
 * Winding order is Counter-Clockwise (CCW).
 */
// prettier-ignore
export const cubeIndices = new Uint16Array([
  0, 1, 2,   0, 2, 3, // Front face
  1, 5, 6,   6, 2, 1, // Right face
  5, 4, 7,   7, 6, 5, // Back face
  4, 0, 3,   3, 7, 4, // Left face
  3, 2, 6,   6, 7, 3, // Top face
  4, 5, 1,   1, 0, 4  // Bottom face
]);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const cubeBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

const elementBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

gl.vertexAttribPointer(
  0,
  3,
  gl.FLOAT,
  false,
  6 * Float32Array.BYTES_PER_ELEMENT,
  0,
);
gl.vertexAttribPointer(
  1,
  3,
  gl.FLOAT,
  false,
  6 * Float32Array.BYTES_PER_ELEMENT,
  3 * Float32Array.BYTES_PER_ELEMENT,
);

gl.enableVertexAttribArray(0);
gl.enableVertexAttribArray(1);

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
glm.mat4.lookAt(viewMatrix, [0, 0, -5], [0, 0, 0], [0, 1, 0]);
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

gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);

gl.enable(gl.DEPTH_TEST);

let lastTime = 0;
let angle = 0;

let identityMatrix = new Float32Array(16);
glm.mat4.identity(identityMatrix);

let myTexture: WebGLTexture | null = null;
async function init() {
  try {
    myTexture = await loadTextureAsync(gl, "/assets/wood.png");
    requestAnimationFrame(animate);
  } catch (error) {
    console.error("Initialization Failed:", error);
  }
}

function animate(currentTime: number) {
  if (!lastTime) lastTime = currentTime;
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  gl.clearColor(0.0, 0.0, 0.5, 1.0);
  gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

  gl.bindVertexArray(vao);

  angle += (dt / 6) * 2 * Math.PI;

  glm.mat4.rotate(worldMatrix, identityMatrix, angle, [1, 1, 0]);
  gl.uniformMatrix4fv(worldMatrixUniformLocation, false, worldMatrix);
  if (myTexture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, myTexture);
  }
  gl.drawElements(gl.TRIANGLES, cubeIndices.length, gl.UNSIGNED_SHORT, 0);
  gl.bindVertexArray(null);
  requestAnimationFrame(animate);
}

init();
