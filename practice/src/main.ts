import "./style.css";
import { loadShaders } from "./webgl";
import vertexShaderSource from "./assets/shader.vert";
import fragmentShaderSource from "./assets/shader.frag";
import * as glm from "gl-matrix";
import { GltfImporter } from "./gltf-loaders";

const canvas = document.createElement("canvas");
const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
document.querySelector("#app")?.append(canvas);

// Base WebGL State
gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);
gl.enable(gl.DEPTH_TEST);

const program = loadShaders(gl, vertexShaderSource, fragmentShaderSource)!;
gl.useProgram(program);

const viewMatrixUniformLocation = gl.getUniformLocation(program, "mView");
const worldMatrixUniformLocation = gl.getUniformLocation(program, "mWorld");
const projMatrixUniformLocation = gl.getUniformLocation(program, "mProjection");

// NEW: Uniform locations for materials
const baseColorFactorLoc = gl.getUniformLocation(program, "uBaseColorFactor");
const hasTextureLoc = gl.getUniformLocation(program, "uHasTexture");
const samplerLoc = gl.getUniformLocation(program, "uSampler");
const alphaModeLoc = gl.getUniformLocation(program, "uAlphaMode");
const alphaCutoffLoc = gl.getUniformLocation(program, "uAlphaCutoff");

let viewMatrix = new Float32Array(16),
  projectionMatrix = new Float32Array(16);

// Set up camera and projection
glm.mat4.lookAt(viewMatrix, [0, 2, 1], [0, 1, 0], [0, 1, 0]);
gl.uniformMatrix4fv(viewMatrixUniformLocation, false, viewMatrix);

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

// Structure to hold our WebGL objects for rendering
interface RenderNode {
  vao: WebGLVertexArrayObject;
  indexCount: number;
  indexType: number;
  localMatrix: Float32Array;
  baseColorFactor: [number, number, number, number];
  texture: WebGLTexture | null;
  alphaMode: string;
  alphaCutoff: number;
}

const renderNodes: RenderNode[] = [];

// --- Orbit Camera State ---
let cameraRadius = 50.0;
let cameraAzimuth = 0;
let cameraElevation = 0.5;

let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener("mouseup", () => (isDragging = false));
canvas.addEventListener("mouseleave", () => (isDragging = false));

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const deltaX = e.clientX - lastMouseX;
  const deltaY = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  if (e.shiftKey) {
    cameraRadius += deltaY * 0.01;
    cameraRadius = Math.max(0.1, cameraRadius);
  } else {
    cameraAzimuth -= deltaX * 0.002;
    cameraElevation += deltaY * 0.002;
    const maxElevation = Math.PI / 2 - 0.01;
    cameraElevation = Math.max(
      -maxElevation,
      Math.min(maxElevation, cameraElevation),
    );
  }
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    cameraRadius += e.deltaY * 0.001;
    cameraRadius = Math.max(0.1, cameraRadius);
  },
  { passive: false },
);

async function init() {
  try {
    const importer = new GltfImporter();
    const asset = await importer.import("/CarConcept.glb");

    // Upload all glTF images to WebGL textures first
    const glTextures: (WebGLTexture | null)[] = asset.images.map((img) => {
      const texture = gl.createTexture();
      if (!texture) return null;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Load the ImageBitmap/HTMLImageElement into WebGL
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        img.data as any,
      );

      // Basic filtering for glTF
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_2D, null);

      return texture;
    });

    // Recursively calculate global transforms and upload buffers
    function processSceneNode(nodeHandle: number, parentMatrix: Float32Array) {
      const node = asset.nodes[nodeHandle];

      const localMatrix = new Float32Array(16);
      if (node.matrix) {
        glm.mat4.copy(localMatrix, node.matrix);
      } else {
        glm.mat4.fromRotationTranslationScale(
          localMatrix,
          node.rotation as glm.ReadonlyQuat,
          node.translation as glm.ReadonlyVec3,
          node.scale as glm.ReadonlyVec3,
        );
      }

      const worldMatrix = new Float32Array(16);
      glm.mat4.multiply(worldMatrix, parentMatrix, localMatrix);

      if (node.meshHandle !== undefined) {
        const mesh = asset.meshes[node.meshHandle];

        mesh.primitives.forEach((primHandle) => {
          const prim = asset.primitives[primHandle];
          const vao = gl.createVertexArray()!;
          gl.bindVertexArray(vao);

          // Upload Positions (Location 0)
          const posBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, prim.positions.data, gl.STATIC_DRAW);
          gl.vertexAttribPointer(
            0,
            3,
            prim.positions.componentType,
            prim.positions.normalized,
            0,
            0,
          );
          gl.enableVertexAttribArray(0);

          // Upload Normals (Location 1)
          if (prim.normals) {
            const normBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, prim.normals.data, gl.STATIC_DRAW);
            gl.vertexAttribPointer(
              1,
              3,
              prim.normals.componentType,
              prim.normals.normalized,
              0,
              0,
            );
            gl.enableVertexAttribArray(1);
          }

          // NEW: Upload UVs/TexCoords (Location 2)
          if (prim.uvs) {
            const uvBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, prim.uvs.data, gl.STATIC_DRAW);
            // Notice size is 2 (vec2) for UVs
            gl.vertexAttribPointer(
              2,
              2,
              prim.uvs.componentType,
              prim.uvs.normalized,
              0,
              0,
            );
            gl.enableVertexAttribArray(2);
          }

          // Upload Indices
          let indexCount = 0;
          let indexType: number = gl.UNSIGNED_SHORT;

          if (prim.indices) {
            const indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              prim.indices.data,
              gl.STATIC_DRAW,
            );
            indexCount = prim.indices.data.length;
            indexType = prim.indices.componentType;
          } else {
            indexCount = prim.positions.data.length / 3;
          }

          gl.bindVertexArray(null);

          // NEW: Resolve the material parameters for this primitive
          let baseColorFactor: [number, number, number, number] = [1, 1, 1, 1]; // Default to white
          let texture: WebGLTexture | null = null;

          if (prim.materialHandle !== undefined) {
            const mat = asset.materials[prim.materialHandle];
            if (mat.baseColorFactor) baseColorFactor = mat.baseColorFactor;

            // If the material has a texture, map its textureHandle -> imageHandle -> WebGLTexture
            if (mat.baseColorTextureHandle !== undefined) {
              const texInfo = asset.textures[mat.baseColorTextureHandle];
              texture = glTextures[texInfo.imageHandle] || null;
            }
          }
          let alphaMode = "OPAQUE";
          let alphaCutoff = 0.5;

          if (prim.materialHandle !== undefined) {
            const mat = asset.materials[prim.materialHandle];
            if (mat.alphaMode) alphaMode = mat.alphaMode;
            if (mat.alphaCutoff !== undefined) alphaCutoff = mat.alphaCutoff;
          }
          // Save to render queue
          renderNodes.push({
            vao,
            indexCount,
            indexType,
            localMatrix: worldMatrix,
            baseColorFactor,
            texture,
            alphaCutoff,
            alphaMode,
          });
        });
      }

      node.children.forEach((child) => processSceneNode(child, worldMatrix));
    }

    const rootMatrix = new Float32Array(16);
    glm.mat4.identity(rootMatrix);
    asset.scenes[0].nodes.forEach((nodeHandle) => {
      processSceneNode(nodeHandle, rootMatrix);
    });

    requestAnimationFrame(animate);
  } catch (error) {
    console.error("Initialization Failed:", error);
  }
}

let lastTime = 0;
function animate(currentTime: number) {
  if (!lastTime) lastTime = currentTime;
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

  const camX =
    cameraRadius * Math.cos(cameraElevation) * Math.sin(cameraAzimuth);
  const camY = cameraRadius * Math.sin(cameraElevation);
  const camZ =
    cameraRadius * Math.cos(cameraElevation) * Math.cos(cameraAzimuth);

  glm.mat4.lookAt(viewMatrix, [camX, camY, camZ], [0, 0, 0], [0, 1, 0]);
  gl.uniformMatrix4fv(viewMatrixUniformLocation, false, viewMatrix);

  // HELPER FUNCTION: Renders a single node
  const drawNode = (rn: RenderNode) => {
    gl.uniformMatrix4fv(worldMatrixUniformLocation, false, rn.localMatrix);
    gl.uniform4fv(baseColorFactorLoc, rn.baseColorFactor);

    // Set Alpha Mode (1 for MASK, 0 otherwise)
    gl.uniform1i(alphaModeLoc, rn.alphaMode === "MASK" ? 1 : 0);
    gl.uniform1f(alphaCutoffLoc, rn.alphaCutoff);

    if (rn.texture) {
      gl.uniform1i(hasTextureLoc, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, rn.texture);
      gl.uniform1i(samplerLoc, 0);
    } else {
      gl.uniform1i(hasTextureLoc, 0);
    }

    gl.bindVertexArray(rn.vao);
    if (rn.indexType) {
      gl.drawElements(gl.TRIANGLES, rn.indexCount, rn.indexType, 0);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, rn.indexCount);
    }
  };

  // 1. OPAQUE PASS: Draw everything solid first
  gl.disable(gl.BLEND);
  gl.depthMask(true); // Allow writing to the depth buffer
  renderNodes.forEach((rn) => {
    if (rn.alphaMode !== "BLEND") drawNode(rn);
  });

  // 2. TRANSPARENT PASS: Draw glass/transparent things on top
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false); // Prevent transparent objects from blocking things behind them
  renderNodes.forEach((rn) => {
    if (rn.alphaMode === "BLEND") drawNode(rn);
  });
  gl.depthMask(true); // Reset for the next frame
  gl.bindVertexArray(null);
  requestAnimationFrame(animate);
}

init();
