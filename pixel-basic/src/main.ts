import type { EditorView } from "codemirror";
import { createEditor } from "./editor";
import { evaluate_program, hoist_program } from "./evaluator";
import { define_builtin_constants, define_builtin_functions, Errors, pass_1_scope_analysis, type Scope, type SymbolEntry } from "./parser_pass_1";
import { parse_program } from "./parser_pass_2";
import { create_environment, type Environment } from "./runtime";
import "./style.css";
import { tokenize } from "./tokenizer";
import { delete_asset, delete_file, get_project_assets, get_project_files, save_asset, save_file, rename_file, rename_asset, type ProjectFile } from "./serialize";

const urlParams = new URLSearchParams(window.location.search);
const PROJECT_ID = urlParams.get("id");
if (!PROJECT_ID) window.location.href = "/";

const canvas = document.getElementById("graphics-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const canvasWrapper = document.getElementById("canvas-wrapper") as HTMLElement;
const editorContainer = document.getElementById("editor-container") as HTMLElement;
const errorDisplay = document.getElementById("error-display") as HTMLElement;
const activeFileTab = document.getElementById("active-file-tab") as HTMLElement;

const btnRun = document.getElementById("btn-run") as HTMLButtonElement;
const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
const btnFullscreen = document.getElementById("btn-fullscreen") as HTMLButtonElement;
const btnNewFile = document.getElementById("btn-new-file") as HTMLButtonElement;
const inputFile = document.getElementById("file-input") as HTMLInputElement;
const assetInput = document.getElementById("asset-input") as HTMLInputElement;

const fileTree = document.getElementById("file-tree") as HTMLUListElement;
const assetTree = document.getElementById("asset-tree") as HTMLUListElement;

let editorView: EditorView | null = null;
let animation_frame_id: number | null = null;
let active_env: Environment | null = null;
const keys_down = new Set<string>();

export const imageAssets = new Map<string, HTMLImageElement>();
let allAssets: any[] = [];
let allFiles: ProjectFile[] = [];
let activeFilename = "main.basic";

function resizeCanvas() {
  canvas.width = canvasWrapper.clientWidth;
  canvas.height = canvasWrapper.clientHeight;
}

// Ensure canvas resizes perfectly when entering/exiting fullscreen
document.addEventListener("fullscreenchange", resizeCanvas);

// --- File System & IDE State ---
async function saveCurrentFile() {
  if (editorView && PROJECT_ID && activeFilename) {
    const code = editorView.state.doc.toString();
    await save_file(PROJECT_ID, activeFilename, code);
    const f = allFiles.find(file => file.filename === activeFilename);
    if (f) f.content = code;
  }
}

async function switchFile(filename: string) {
  await saveCurrentFile();
  activeFilename = filename;
  activeFileTab.textContent = filename;
  const targetFile = allFiles.find(f => f.filename === filename);
  const content = targetFile ? targetFile.content : "";
  editorContainer.innerHTML = "";
  editorView = createEditor(editorContainer, content, executeMain);
  renderSidebar();
}

function renderSidebar() {
  fileTree.innerHTML = "";
  const sortedFiles = [...allFiles].sort((a, b) => {
    if (a.filename === "main.basic") return -1;
    if (b.filename === "main.basic") return 1;
    return a.filename.localeCompare(b.filename);
  });

  sortedFiles.forEach(file => {
    const li = document.createElement("li");
    li.className = `tree-item ${file.filename === activeFilename ? "active" : ""}`;
    li.innerHTML = `<span>📄 ${file.filename}</span>`;

    if (file.filename !== "main.basic") {
      const actions = document.createElement("div");
      actions.className = "tree-item-actions";

      // Rename Button
      const renBtn = document.createElement("button");
      renBtn.className = "tree-item-action";
      renBtn.textContent = "✎";
      renBtn.title = "Rename";
      renBtn.onclick = async (e) => {
        e.stopPropagation();
        let newName = prompt(`Rename ${file.filename} to:`, file.filename);
        if (!newName || newName === file.filename) return;
        if (!newName.endsWith(".basic")) newName += ".basic";

        if (allFiles.some(f => f.filename === newName)) {
          alert("A file with this name already exists!");
          return;
        }

        await rename_file(PROJECT_ID!, file.filename, newName, file.content);

        const wasActive = activeFilename === file.filename;
        file.id = `${PROJECT_ID}_${newName}`;
        file.filename = newName;

        if (wasActive) {
          activeFilename = newName;
          activeFileTab.textContent = newName;
        }
        renderSidebar();
      };

      // Delete Button
      const delBtn = document.createElement("button");
      delBtn.className = "tree-item-action delete";
      delBtn.textContent = "x";
      delBtn.title = "Delete";
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${file.filename}?`)) {
          await delete_file(file.id);
          allFiles = allFiles.filter(f => f.id !== file.id);
          if (activeFilename === file.filename) switchFile("main.basic");
          else renderSidebar();
        }
      };

      actions.appendChild(renBtn);
      actions.appendChild(delBtn);
      li.appendChild(actions);
    }
    li.onclick = () => switchFile(file.filename);
    fileTree.appendChild(li);
  });

  assetTree.innerHTML = "";
  allAssets.forEach(asset => {
    const li = document.createElement("li");
    li.className = "tree-item";
    const icon = asset.type.startsWith("image/") ? "🖼️" : "🔤";
    li.innerHTML = `<span>${icon} ${asset.name}</span>`;

    const actions = document.createElement("div");
    actions.className = "tree-item-actions";

    // Rename Asset Button
    const renBtn = document.createElement("button");
    renBtn.className = "tree-item-action";
    renBtn.textContent = "✎";
    renBtn.title = "Rename";
    renBtn.onclick = async (e) => {
      e.stopPropagation();
      const newName = prompt(`Rename ${asset.name} to:`, asset.name);
      if (!newName || newName === asset.name) return;

      if (allAssets.some(a => a.name === newName)) {
        alert("An asset with this name already exists!");
        return;
      }

      await rename_asset(PROJECT_ID!, asset.name, newName, asset.type, asset.data);

      // Update in-memory registry
      if (imageAssets.has(asset.name)) {
        imageAssets.set(newName, imageAssets.get(asset.name)!);
        imageAssets.delete(asset.name);
      }

      asset.id = `${PROJECT_ID}_${newName}`;
      asset.name = newName;
      renderSidebar();
    };

    // Delete Asset Button
    const delBtn = document.createElement("button");
    delBtn.className = "tree-item-action delete";
    delBtn.textContent = "x";
    delBtn.title = "Delete";
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Delete asset ${asset.name}?`)) {
        await delete_asset(asset.id);
        imageAssets.delete(asset.name);
        allAssets = allAssets.filter((a) => a.id !== asset.id);
        renderSidebar();
      }
    };

    actions.appendChild(renBtn);
    actions.appendChild(delBtn);
    li.appendChild(actions);
    assetTree.appendChild(li);
  });
}

btnNewFile.addEventListener("click", async () => {
  if (!PROJECT_ID) return;
  let name = prompt("Enter script path (e.g., utils/math.basic):", "new.basic");
  if (!name) return;
  if (!name.endsWith(".basic")) name += ".basic";
  if (allFiles.some(f => f.filename === name)) {
    alert("File already exists!");
    return;
  }
  await save_file(PROJECT_ID, name, "");
  allFiles.push({ id: `${PROJECT_ID}_${name}`, project_id: PROJECT_ID, filename: name, content: "" });
  switchFile(name);
});

// --- Execution & Module Loader Pipeline ---
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

function compile_and_run(entry_filename: string) {
  stop_engine();
  resizeCanvas();

  const update_env = (name: string, value: any) => {
    if (active_env)
      active_env.assign(name, { type: Number.isInteger(value) ? "i32" : "f32", value });
  };

  const moduleCache = new Map<string, { env: Environment; ast: import("./ast_types").Program }>();
  const loadingStack = new Set<string>();

  function load_module(filename: string): { env: Environment; ast: import("./ast_types").Program } | null {
    if (moduleCache.has(filename)) return moduleCache.get(filename)!;
    if (loadingStack.has(filename)) {
      errorDisplay.textContent = `Circular import detected: ${[...loadingStack, filename].join(" -> ")}`;
      errorDisplay.style.display = "flex";
      return null;
    }
    loadingStack.add(filename);

    const fileData = allFiles.find((f) => f.filename === filename);
    if (!fileData) {
      errorDisplay.textContent = `Module not found: '${filename}'`;
      errorDisplay.style.display = "flex";
      return null;
    }

    const mod_env = create_environment(
      null,
      define_builtin_functions(ctx, keys_down, update_env, imageAssets)
    );
    define_builtin_constants(mod_env, canvas.width, canvas.height);
    mod_env.assign("SCR_W", { type: "i32", value: canvas.width });
    mod_env.assign("SCR_H", { type: "i32", value: canvas.height });

    const scopes: Scope[] = [
      { id: 0, parent_id: null, start_token: 0, end_token: 0, symbols: new Map<string, SymbolEntry>() },
    ];
    Errors.length = 0;

    const { tokens, errors: lexErrors } = tokenize(fileData.content);
    if (lexErrors && lexErrors.length > 0) {
      errorDisplay.textContent = `[${filename}] Lex Error: ${lexErrors[0].message}`;
      errorDisplay.style.display = "flex";
      return null;
    }

    pass_1_scope_analysis(tokens, scopes);
    if (Errors.length > 0) {
      errorDisplay.textContent = `[${filename}] Scope Error: ${Errors[0].message}`;
      errorDisplay.style.display = "flex";
      return null;
    }

    const ast = parse_program(tokens, scopes);
    if (Errors.length > 0) {
      errorDisplay.textContent = `[${filename}] Parse Error: ${Errors[0].message}`;
      errorDisplay.style.display = "flex";
      return null;
    }

    for (const node of ast.body) {
      if (node.type === "ImportStatement") {
        const targetMod = load_module(node.source);
        if (!targetMod) return null;

        for (const sym of node.symbols) {
          if (targetMod.env.functionMap.has(sym)) {
            const fn_entry = targetMod.env.functionMap.get(sym)!;
            if (fn_entry.declaration && !fn_entry.declaration.is_export) {
              errorDisplay.textContent = `[${filename}] Import Error: Subroutine '${sym}' is not exported in '${node.source}'.`;
              errorDisplay.style.display = "flex";
              return null;
            }
            mod_env.functionMap.set(sym, fn_entry);
          } else {
            let is_exported = false;
            for (const tNode of targetMod.ast.body) {
              if (tNode.type === "VariableDeclaration" && tNode.target === sym && tNode.is_export) {
                is_exported = true;
                break;
              }
            }
            if (!is_exported) {
              errorDisplay.textContent = `[${filename}] Import Error: Variable '${sym}' is not exported in '${node.source}'.`;
              errorDisplay.style.display = "flex";
              return null;
            }
            const val = targetMod.env.get(sym);
            if (val !== null) mod_env.define(sym, val);
          }
        }
      }
    }

    hoist_program(ast, mod_env);

    if (filename !== entry_filename) {
      const interpreter = evaluate_program(ast, mod_env);
      let result = interpreter.next();
      while (!result.done) {
        if (result.value && result.value.status === "error") {
          const prefix = result.value.line ? `[Line ${result.value.line}] ` : "";
          errorDisplay.textContent = `[${filename}] Runtime Error ${prefix}: ${result.value.message}`;
          errorDisplay.style.display = "flex";
          return null;
        }
        result = interpreter.next();
      }
    }

    loadingStack.delete(filename);
    const modData = { env: mod_env, ast };
    moduleCache.set(filename, modData);
    return modData;
  }

  const entryModule = load_module(entry_filename);
  if (!entryModule) return;

  active_env = entryModule.env;
  const interpreter = evaluate_program(entryModule.ast, active_env);

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
          const prefix = result.value.line ? `[Line ${result.value.line}] ` : "";
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

const executeMain = async () => {
  await saveCurrentFile();
  const mainFile = allFiles.find(f => f.filename === "main.basic");
  if (mainFile) compile_and_run("main.basic");
};

// --- Initialization ---
async function loadAssetIntoMemory(asset: any) {
  if (asset.type.startsWith("image/")) {
    const img = new Image();
    img.src = asset.data;
    await new Promise((resolve) => (img.onload = resolve));
    imageAssets.set(asset.name, img);
  } else if (
    asset.name.endsWith(".ttf") || asset.name.endsWith(".otf") || asset.name.endsWith(".woff") || asset.name.endsWith(".woff2")
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
  if (!PROJECT_ID) return;
  resizeCanvas();
  editorContainer.innerHTML = "";

  allAssets = await get_project_assets(PROJECT_ID);
  for (const asset of allAssets) await loadAssetIntoMemory(asset);

  allFiles = await get_project_files(PROJECT_ID);
  if (allFiles.length === 0) {
    await save_file(PROJECT_ID, "main.basic", "");
    allFiles = await get_project_files(PROJECT_ID);
  }

  await switchFile("main.basic");
  executeMain();

  setInterval(saveCurrentFile, 5000);
}

initEditor();

// --- Input & Import Handling ---
canvas.addEventListener("keydown", (e) => keys_down.add(e.key));
canvas.addEventListener("keyup", (e) => keys_down.delete(e.key));
canvas.addEventListener("mousemove", (e) => {
  if (active_env) {
    const rect = canvas.getBoundingClientRect();
    active_env.assign("MOUSE_X", { type: "i32", value: e.clientX - rect.left });
    active_env.assign("MOUSE_Y", { type: "i32", value: e.clientY - rect.top });
  }
});

btnFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    canvasWrapper.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
});

assetInput.addEventListener("change", async (e) => {
  if (!PROJECT_ID) return;
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = async () => {
      const asset = {
        id: `${PROJECT_ID}_${file.name}`,
        project_id: PROJECT_ID,
        name: file.name,
        type: file.type,
        data: reader.result as string,
      };
      await save_asset(PROJECT_ID, file.name, file.type, reader.result as string);
      allAssets.push(asset);
      await loadAssetIntoMemory(asset);
      renderSidebar();
    };
    reader.readAsDataURL(file);
  }
  assetInput.value = "";
});

inputFile.addEventListener("change", (event) => {
  if (!PROJECT_ID) return;
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = async () => {
    const result = reader.result;
    if (typeof result === "string") {
      let filename = file.name;
      if (!filename.endsWith(".basic")) filename += ".basic";

      if (allFiles.some(f => f.filename === filename)) {
        alert(`A script named ${filename} already exists in this project!`);
        return;
      }

      await save_file(PROJECT_ID, filename, result);
      allFiles.push({
        id: `${PROJECT_ID}_${filename}`,
        project_id: PROJECT_ID,
        filename,
        content: result
      });

      await switchFile(filename);
    }
  };

  reader.onerror = () => {
    errorDisplay.textContent = "Failed loading the text file";
    errorDisplay.style.display = "flex";
  };

  reader.readAsText(file);
  input.value = "";
});

// --- Controls & UI ---
btnRun.addEventListener("click", executeMain);
btnStop.addEventListener("click", stop_engine);

let isDragging1 = false, isDragging2 = false;
const div1 = document.getElementById("drag-divider-1") as HTMLElement;
const div2 = document.getElementById("drag-divider-2") as HTMLElement;
const sidebarPane = document.getElementById("sidebar-pane") as HTMLElement;
const editorPane = document.getElementById("editor-pane") as HTMLElement;

// Attach Mouse & Touch start events
div1.addEventListener("mousedown", () => { isDragging1 = true; });
div1.addEventListener("touchstart", () => { isDragging1 = true; }, { passive: true });

div2.addEventListener("mousedown", () => { isDragging2 = true; canvasWrapper.style.pointerEvents = "none"; });
div2.addEventListener("touchstart", () => { isDragging2 = true; canvasWrapper.style.pointerEvents = "none"; }, { passive: true });

// Universal movement handler
const handleMove = (clientX: number, clientY: number) => {
  const isMobile = window.innerWidth <= 768;

  if (isDragging1) {
    if (isMobile) {
      const topOffset = document.getElementById("top-bar")?.clientHeight || 56;
      const newHeight = Math.max(100, Math.min(clientY - topOffset, window.innerHeight * 0.4));
      sidebarPane.style.flex = `0 0 ${newHeight}px`;
    } else {
      const newWidth = Math.max(150, Math.min(clientX, window.innerWidth * 0.4));
      sidebarPane.style.flex = `0 0 ${newWidth}px`;
    }
  }
  else if (isDragging2) {
    if (isMobile) {
      const workspaceHeight = document.getElementById("workspace")!.clientHeight;
      const sidebarHeight = sidebarPane.clientHeight;
      const remainingHeight = workspaceHeight - sidebarHeight;
      const topOffset = document.getElementById("top-bar")?.clientHeight || 56;

      const newBasis = ((clientY - topOffset - sidebarHeight) / remainingHeight) * 100;
      if (newBasis > 10 && newBasis < 90) {
        editorPane.style.flex = `0 0 ${newBasis}%`;
        resizeCanvas();
      }
    } else {
      const workspaceWidth = document.getElementById("workspace")!.clientWidth;
      const sidebarWidth = sidebarPane.clientWidth;
      const remainingWidth = workspaceWidth - sidebarWidth;

      const newBasis = ((clientX - sidebarWidth) / remainingWidth) * 100;
      if (newBasis > 10 && newBasis < 90) {
        editorPane.style.flex = `0 0 ${newBasis}%`;
        resizeCanvas();
      }
    }
  }
};

window.addEventListener("mousemove", (e) => {
  if (isDragging1 || isDragging2) handleMove(e.clientX, e.clientY);
});

window.addEventListener("touchmove", (e) => {
  if (isDragging1 || isDragging2) handleMove(e.touches[0].clientX, e.touches[0].clientY);
});

const handleUp = () => {
  isDragging1 = false;
  isDragging2 = false;
  canvasWrapper.style.pointerEvents = "auto";
};

window.addEventListener("mouseup", handleUp);
window.addEventListener("touchend", handleUp);
