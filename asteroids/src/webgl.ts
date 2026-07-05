export function createWebGL2Context(
  width: number,
  height: number,
  parentElement: HTMLElement,
): { canvas: HTMLCanvasElement; ctx: WebGL2RenderingContext } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("webgl2")!;
  canvas.width = width;
  canvas.height = height;
  parentElement.append(canvas);

  ctx.viewport(0, 0, width, height);

  return { canvas, ctx };
}
