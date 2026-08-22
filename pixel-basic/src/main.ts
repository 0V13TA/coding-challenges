import type { EditorView } from "codemirror";
import ExampleSource from "./assets/p.basic?raw";
import { createEditor, serializeEditorState } from "./editor";
import { evaluate_program, hoist_program } from "./evaluator";
import {
  define_builtin_constants,
  define_builtin_functions,
  Errors,
  pass_1_scope_analysis,
  type Scope,
  type SymbolEntry,
} from "./parser_pass_1";
import { parse_program } from "./parser_pass_2";
import { create_environment, type Environment } from "./runtime";
import "./style.css";
import { tokenize } from "./tokenizer";
import {
  delete_asset,
  load_basic_code,
  save_asset,
  save_basic_code,
} from "./serialize";

const canvas = document.getElementById("graphics-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
if (!ctx) throw new Error("Sorry but your system does not support HTML Canvas");

function resizeCanvas() {
  canvas.width = canvasWrapper.clientWidth;
  canvas.height = canvasWrapper.clientHeight;
}

const canvasWrapper = document.getElementById("canvas-wrapper") as HTMLElement;
const editorContainer = document.getElementById(
  "editor-container",
) as HTMLElement;
const errorDisplay = document.getElementById("error-display") as HTMLElement;
const inputFile = document.getElementById("file-input") as HTMLInputElement;

const btnRun = document.getElementById("btn-run") as HTMLButtonElement;
const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
const btnAssets = document.getElementById("btn-assets") as HTMLButtonElement;

const assetModal = document.getElementById("asset-modal") as HTMLElement;
const btnCloseAssets = document.getElementById(
  "btn-close-assets",
) as HTMLButtonElement;
const assetInput = document.getElementById("asset-input") as HTMLInputElement;
const assetList = document.getElementById("asset-list") as HTMLUListElement;

let editorView: EditorView | null = null;
let animation_frame_id: number | null = null;
let active_env: Environment | null = null;
const keys_down = new Set<string>();

// --- Memory Registry ---
export const imageAssets = new Map<string, HTMLImageElement>();
let allAssets: any[] = [];

// --- Execution Pipeline ---
function stop_engine() {
  if (animation_frame_id !== null) {
    cancelAnimationFrame(animation_frame_id);
    animation_frame_id = null;
  }
  active_env = null;
  keys_down.clear();
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  console.log("Engine Halted.");
}

function compile_and_run(source_code: string) {
  stop_engine();
  resizeCanvas();

  const update_env = (name: string, value: any) => {
    if (active_env) active_env.assign(name, { type: Number.isInteger(value) ? "i32" : "f32", value });
  };

  active_env = create_environment(
    null,
    define_builtin_functions(ctx, keys_down, update_env, imageAssets),
  );
  define_builtin_constants(active_env, canvas.width, canvas.height);
  active_env.assign("SCR_W", { type: "i32", value: canvas.width });
  active_env.assign("SCR_H", { type: "i32", value: canvas.height });

  let scopes: Scope[] = [
    {
      id: 0,
      parent_id: null,
      start_token: 0,
      end_token: 0,
      symbols: new Map<string, SymbolEntry>(),
    },
  ];

  // 1. Wipe old parse records
  Errors.length = 0;
  const { tokens, errors: lexErrors } = tokenize(source_code);

  if (lexErrors && lexErrors.length > 0) {
    errorDisplay.textContent = `[Line ${lexErrors[0].line}] ${lexErrors[0].message}`;
    errorDisplay.style.display = "flex";
    return;
  }

  pass_1_scope_analysis(tokens, scopes);

  if (Errors.length > 0) {
    errorDisplay.textContent = `[Line ${Errors[0].line}] ${Errors[0].message}`;
    errorDisplay.style.display = "flex";
    return;
  }

  const ast = parse_program(tokens, scopes);

  if (Errors.length > 0) {
    errorDisplay.textContent = `[Line ${Errors[0].line}] ${Errors[0].message}`;
    errorDisplay.style.display = "flex";
    return;
  }

  hoist_program(ast, active_env);
  const interpreter = evaluate_program(ast, active_env);

  const TARGET_FPS = 60;
  const STEP_MS = 1000 / TARGET_FPS;
  let last_time = performance.now();
  let accumulator = 0;

  function engine_tick(current_time: number) {
    let delta_time = current_time - last_time;
    last_time = current_time;

    if (delta_time > 250) delta_time = 250;
    accumulator += delta_time;
    let is_running = true;

    while (accumulator >= STEP_MS) {
      const result = interpreter.next();
      accumulator -= STEP_MS;
      if (result.done || (result.value && result.value.status !== "running")) {
        is_running = false;
        if (result.value?.status === "error") {
          // Expose physical location of runtime crash
          const prefix = result.value.line
            ? `[Line ${result.value.line}] `
            : "";
          errorDisplay.textContent = `${prefix}${result.value.message}`;
          errorDisplay.style.display = "flex";
        }
        break;
      }
    }

    if (is_running) {
      animation_frame_id = requestAnimationFrame(engine_tick);
    } else {
      console.log("Program Execution Terminated.");
      animation_frame_id = null;
    }
  }

  errorDisplay.style.display = "none";
  animation_frame_id = requestAnimationFrame(engine_tick);
}

// --- Editor Setup ---
const btnToggleEditor = document.getElementById(
  "btn-toggle-editor",
) as HTMLButtonElement;
const dragDivider = document.getElementById("drag-divider") as HTMLElement;
const editorPane = document.getElementById("editor-pane") as HTMLElement;

resizeCanvas();
const executeCode = () => {
  if (editorView) compile_and_run(editorView.state.doc.toString());
};

async function loadAssetIntoMemory(asset: any) {
  // Mount Images for immediate rendering
  if (asset.type.startsWith("image/")) {
    const img = new Image();
    img.src = asset.data;
    await new Promise((resolve) => (img.onload = resolve));
    imageAssets.set(asset.name, img);
  }
  // Mount Fonts directly to Document API using native CSSFontFace format
  else if (
    asset.name.endsWith(".ttf") ||
    asset.name.endsWith(".otf") ||
    asset.name.endsWith(".woff") ||
    asset.name.endsWith(".woff2")
  ) {
    const fontName = asset.name.split(".")[0];
    const font = new FontFace(fontName, `url(${asset.data})`);
    try {
      await font.load();
      document.fonts.add(font);
    } catch (e) {
      console.error("Failed to load font", e);
    }
  }
}

async function initEditor() {
  resizeCanvas();
  editorContainer.innerHTML = "";

  // 1. Await database load
  const savedData = await load_basic_code();

  // 2. Boot from DB if it exists, otherwise fallback to the demo string
  const initialData = savedData ? savedData : ExampleSource;

  editorView = createEditor(editorContainer, initialData, executeCode);
  compile_and_run(editorView.state.doc.toString());

  // 3. Initiate the 5-second auto-save loop
  setInterval(() => {
    if (editorView) {
      const stateJSON = serializeEditorState(editorView);
      save_basic_code(stateJSON);
    }
  }, 5000);
}

initEditor();

// --- System Keybindings & File Loading ---
canvas.addEventListener("keydown", (e) => keys_down.add(e.key));
canvas.addEventListener("keyup", (e) => keys_down.delete(e.key));
canvas.addEventListener("mousemove", (e) => {
  if (active_env) {
    // Get the bounding rectangle of the canvas to offset the screen coordinates
    const rect = canvas.getBoundingClientRect();

    // Calculate the mouse position relative to the canvas dimensions
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Update the runtime environment variables
    active_env.assign("MOUSE_X", { type: "i32", value: mouseX });
    active_env.assign("MOUSE_Y", { type: "i32", value: mouseY });
  }
});

// --- UI Controls ---
function renderAssetList() {
  assetList.innerHTML = "";
  allAssets.forEach((asset) => {
    const li = document.createElement("li");
    li.textContent = asset.name;
    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑";
    delBtn.className = "delete-asset-btn";
    delBtn.onclick = async () => {
      await delete_asset(asset.name);
      imageAssets.delete(asset.name);
      allAssets = allAssets.filter((a) => a.name !== asset.name);
      renderAssetList();
    };
    li.appendChild(delBtn);
    assetList.appendChild(li);
  });
}
btnAssets.addEventListener("click", () => {
  renderAssetList();
  assetModal.style.display = "flex";
});

btnCloseAssets.addEventListener("click", () => {
  assetModal.style.display = "none";
});

assetInput.addEventListener("change", async (e) => {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();

    // Read the file as a robust base64 DataURL
    reader.onload = async () => {
      const asset = {
        name: file.name,
        type: file.type,
        data: reader.result as string,
      };
      await save_asset(asset);
      allAssets.push(asset);
      await loadAssetIntoMemory(asset);
      renderAssetList();
    };
    reader.readAsDataURL(file);
  }
  assetInput.value = ""; // Reset input so same file can trigger change again
});

btnRun.addEventListener("click", executeCode);
btnStop.addEventListener("click", stop_engine);
btnSave.addEventListener("click", () => {
  if (!editorView) return;
  const code = editorView.state.doc.toString();
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "program.basic";
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
inputFile.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  let file: File | null = null;
  if (input !== null && input.files !== null) {
    file = input.files[0];
    if (!file.type.startsWith("text"))
      errorDisplay.textContent = "File must be a text file";
  }

  const reader = new FileReader();
  reader.onload = () => {
    console.log("loaded");
    const result = reader.result;
    if (result === null) return;
    if (typeof result === "string") {
      editorContainer.innerHTML = "";
      editorView = createEditor(editorContainer, result, executeCode);
      compile_and_run(result);
    }
  };

  reader.onerror = () => {
    errorDisplay.textContent = "Failed loading the text file";
    errorDisplay.style.display = "flex";
  };
  reader.onabort = () => {
    errorDisplay.textContent = "Failed loading the text file";
    errorDisplay.style.display = "flex";
  };

  if (file !== null) reader.readAsText(file);
  else {
    errorDisplay.textContent = "Failed loading the text file";
    errorDisplay.style.display = "flex";
  }
});

// --- Toggle Editor ---
let isEditorOpen = true;
btnToggleEditor.addEventListener("click", () => {
  isEditorOpen = !isEditorOpen;
  editorPane.style.display = isEditorOpen ? "flex" : "none";
  dragDivider.style.display = isEditorOpen ? "block" : "none";
  btnToggleEditor.textContent = isEditorOpen ? "◀ EDITOR" : "▶ EDITOR";
  resizeCanvas(); // Trigger paint recalibration
});

// --- Resizer / Drag Divider ---
let isDragging = false;

dragDivider.addEventListener("mousedown", () => {
  isDragging = true;
  dragDivider.classList.add("dragging");
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  canvasWrapper.style.pointerEvents = "none"; // Stop iframe/canvas from swallowing pointer events
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const workspaceWidth = document.getElementById("workspace")!.clientWidth;
  const newBasis = (e.clientX / workspaceWidth) * 100;
  // Constrain the editor pane between 5% and 95% of the screen
  if (newBasis > 5 && newBasis < 95) {
    editorPane.style.flex = `0 0 ${newBasis}%`;
    resizeCanvas();
  }
});

window.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    dragDivider.classList.remove("dragging");
    document.body.style.cursor = "default";
    document.body.style.userSelect = "";
    canvasWrapper.style.pointerEvents = "auto";
  }
});
