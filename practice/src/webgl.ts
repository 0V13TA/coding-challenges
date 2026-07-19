export function loadShaders(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
) {
  const vertShader = gl.createShader(gl.VERTEX_SHADER);
  if (!vertShader) {
    console.error("Failed to load vertex shader");
    return null;
  }
  gl.shaderSource(vertShader, vert);
  gl.compileShader(vertShader);
  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    const compileError = gl.getShaderInfoLog(vertShader);
    console.error(compileError);
    return null;
  }

  const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fragShader) {
    console.error("Failed to load vertex shader");
    return null;
  }
  gl.shaderSource(fragShader, frag);
  gl.compileShader(fragShader);
  if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    const compileError = gl.getShaderInfoLog(fragShader);
    console.error(compileError);
    return null;
  }

  const shaderProgram = gl.createProgram();
  if (!shaderProgram) {
    console.log("Failed to create shader program");
    return null;
  }
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    const compileError = gl.getProgramInfoLog(shaderProgram);
    console.error(`Linking Error: ${compileError}`);
    return null;
  }

  gl.deleteShader(vertShader);
  gl.deleteShader(fragShader);

  return shaderProgram;
}

export function createVAO(gl: WebGL2RenderingContext, func: () => void) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  func();
  gl.bindVertexArray(null);
  return vao;
}

export function loadTextureAsync(
  gl: WebGL2RenderingContext,
  url: string,
): Promise<WebGLTexture> {
  return new Promise((resolve, reject) => {
    const texture = gl.createTexture();
    if (!texture) {
      return reject(new Error("Failed to create WebGL texture"));
    }

    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );

      if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }

      gl.bindTexture(gl.TEXTURE_2D, null);
      resolve(texture);
    };

    image.onerror = () => {
      reject(new Error(`Failed to load texture image at: ${url}`));
    };
    image.src = url;
  });
}

function isPowerOf2(value: number): boolean {
  return (value & (value - 1)) === 0;
}
