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
  gl.attachShader(shaderProgram, vertShader);
  gl.attachShader(shaderProgram, fragShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    const compileError = gl.getProgramInfoLog(shaderProgram);
    console.error(`Linking Error: ${compileError}`);
    return null;
  }

  return shaderProgram;
}
