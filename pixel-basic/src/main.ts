import type { EditorView } from "codemirror";
import { createEditor } from "./editor";
import "./style.css";
import {
  delete_asset,
  delete_file,
  get_project_assets,
  get_project_files,
  save_asset,
  save_file,
  rename_file,
  rename_asset,
  type ProjectFile,
  type Asset,
} from "./serialize";

const urlParams = new URLSearchParams(window.location.search);
const PROJECT_ID = urlParams.get("id");
if (!PROJECT_ID) window.location.href = "/";

const canvas = document.getElementById("graphics-canvas") as HTMLCanvasElement;
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
let allAssets: Asset[] = [];
let allFiles: ProjectFile[] = [];
let activeFilename = "main.basic";

// --- Instantiate Worker & OffscreenCanvas ---
const engineWorker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});

const offscreen = canvas.transferControlToOffscreen();
engineWorker.postMessage(
  {
    type: "INIT",
    payload: { canvas: offscreen },
  },
  [offscreen],
);

engineWorker.onmessage = (e: MessageEvent) => {
  const { type, message } = e.data;
  if (type === "ERROR") {
    errorDisplay.textContent = message;
    errorDisplay.style.display = "flex";
  } else if (type === "STARTED") {
    errorDisplay.style.display = "none";
  }
};

function resizeCanvas() {
  const width = canvasWrapper.clientWidth;
  const height = canvasWrapper.clientHeight;
  engineWorker.postMessage({
    type: "RESIZE",
    payload: { width, height },
  });
}

document.addEventListener("fullscreenchange", resizeCanvas);

function stop_engine() {
  engineWorker.postMessage({ type: "STOP" });
}

function compile_and_run(entry_filename: string) {
  engineWorker.postMessage({
    type: "SET_FILES",
    payload: { files: allFiles },
  });
  engineWorker.postMessage({
    type: "RUN",
    payload: { filename: entry_filename },
  });
}

const executeMain = async () => {
  await saveCurrentFile();
  const mainFile = allFiles.find((f) => f.filename === "main.basic");
  if (mainFile) compile_and_run("main.basic");
};

// --- Asset Synchronization ---
async function syncAssetsToWorker() {
  const bitmaps: { name: string; bitmap: ImageBitmap }[] = [];
  const transferables: Transferable[] = [];

  for (const asset of allAssets) {
    if (asset.type.startsWith("image/")) {
      const res = await fetch(asset.data);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      bitmaps.push({ name: asset.name, bitmap });
      transferables.push(bitmap);
    } else if (
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
      } catch (err) {
        console.error("Failed to load font", err);
      }
    }
  }

  engineWorker.postMessage(
    { type: "SET_ASSETS", payload: { assets: bitmaps } },
    transferables,
  );
}

// --- File System & IDE State ---
async function saveCurrentFile() {
  if (editorView && PROJECT_ID && activeFilename) {
    const code = editorView.state.doc.toString();
    await save_file(PROJECT_ID, activeFilename, code);
    const f = allFiles.find((file) => file.filename === activeFilename);
    if (f) f.content = code;
  }
}

async function switchFile(filename: string) {
  await saveCurrentFile();
  activeFilename = filename;
  activeFileTab.textContent = filename;
  const targetFile = allFiles.find((f) => f.filename === filename);
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

  sortedFiles.forEach((file) => {
    const li = document.createElement("li");
    li.className = `tree-item ${file.filename === activeFilename ? "active" : ""}`;
    li.innerHTML = `<span>${file.filename}</span>`;
    if (file.filename !== "main.basic") {
      const actions = document.createElement("div");
      actions.className = "tree-item-actions";

      const renBtn = document.createElement("button");
      renBtn.className = "tree-item-action";
      renBtn.textContent = "✎";
      renBtn.title = "Rename";
      renBtn.onclick = async (e) => {
        e.stopPropagation();
        let newName = prompt(`Rename ${file.filename} to:`, file.filename);
        if (!newName || newName === file.filename) return;
        if (!newName.endsWith(".basic")) newName += ".basic";
        if (allFiles.some((f) => f.filename === newName)) {
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

      const delBtn = document.createElement("button");
      delBtn.className = "tree-item-action delete";
      delBtn.textContent = "x";
      delBtn.title = "Delete";
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${file.filename}?`)) {
          await delete_file(file.id);
          allFiles = allFiles.filter((f) => f.id !== file.id);
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
  allAssets.forEach((asset) => {
    const li = document.createElement("li");
    li.className = "tree-item";
    const icon = asset.type.startsWith("image/") ? "🖼" : "🔤";
    li.innerHTML = `<span>${icon} ${asset.name}</span>`;
    const actions = document.createElement("div");
    actions.className = "tree-item-actions";

    const renBtn = document.createElement("button");
    renBtn.className = "tree-item-action";
    renBtn.textContent = "✎";
    renBtn.title = "Rename";
    renBtn.onclick = async (e) => {
      e.stopPropagation();
      const newName = prompt(`Rename ${asset.name} to:`, asset.name);
      if (!newName || newName === asset.name) return;
      if (allAssets.some((a) => a.name === newName)) {
        alert("An asset with this name already exists!");
        return;
      }
      await rename_asset(PROJECT_ID!, asset.name, newName, asset.type, asset.data);
      asset.id = `${PROJECT_ID}_${newName}`;
      asset.name = newName;
      await syncAssetsToWorker();
      renderSidebar();
    };

    const delBtn = document.createElement("button");
    delBtn.className = "tree-item-action delete";
    delBtn.textContent = "x";
    delBtn.title = "Delete";
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Delete asset ${asset.name}?`)) {
        await delete_asset(asset.id);
        allAssets = allAssets.filter((a) => a.id !== asset.id);
        await syncAssetsToWorker();
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
  if (allFiles.some((f) => f.filename === name)) {
    alert("File already exists!");
    return;
  }
  await save_file(PROJECT_ID, name, "");
  allFiles.push({
    id: `${PROJECT_ID}_${name}`,
    project_id: PROJECT_ID,
    filename: name,
    content: "",
  });
  switchFile(name);
});

async function initEditor() {
  if (!PROJECT_ID) return;
  resizeCanvas();
  editorContainer.innerHTML = "";
  allAssets = await get_project_assets(PROJECT_ID);
  await syncAssetsToWorker();

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

// --- Input Forwarding ---
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  engineWorker.postMessage({
    type: "INPUT_MOUSE_MOVE",
    payload: { x: e.clientX - rect.left, y: e.clientY - rect.top },
  });
});

canvas.addEventListener("mousedown", () => {
  engineWorker.postMessage({
    type: "INPUT_MOUSE_DOWN",
    payload: { down: true },
  });
});

window.addEventListener("mouseup", () => {
  engineWorker.postMessage({
    type: "INPUT_MOUSE_DOWN",
    payload: { down: false },
  });
});

canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length > 0) {
    const rect = canvas.getBoundingClientRect();
    engineWorker.postMessage({
      type: "INPUT_MOUSE_MOVE",
      payload: { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top },
    });
    engineWorker.postMessage({
      type: "INPUT_MOUSE_DOWN",
      payload: { down: true },
    });
  }
}, { passive: true });

canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length > 0) {
    const rect = canvas.getBoundingClientRect();
    engineWorker.postMessage({
      type: "INPUT_MOUSE_MOVE",
      payload: { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top },
    });
  }
}, { passive: true });

window.addEventListener("touchend", () => {
  engineWorker.postMessage({
    type: "INPUT_MOUSE_DOWN",
    payload: { down: false },
  });
});

canvas.addEventListener("keydown", (e) => {
  engineWorker.postMessage({
    type: "INPUT_KEY",
    payload: { key: e.key, down: true },
  });
});

canvas.addEventListener("keyup", (e) => {
  engineWorker.postMessage({
    type: "INPUT_KEY",
    payload: { key: e.key, down: false },
  });
});

btnFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    canvasWrapper.requestFullscreen().catch((err) => {
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
      await syncAssetsToWorker();
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
      if (allFiles.some((f) => f.filename === filename)) {
        alert(`A script named ${filename} already exists in this project!`);
        return;
      }
      await save_file(PROJECT_ID, filename, result);
      allFiles.push({
        id: `${PROJECT_ID}_${filename}`,
        project_id: PROJECT_ID,
        filename,
        content: result,
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

btnRun.addEventListener("click", executeMain);
btnStop.addEventListener("click", stop_engine);

// --- Layout Resizing Controls ---
let isDragging1 = false;
let isDragging2 = false;
const div1 = document.getElementById("drag-divider-1") as HTMLElement;
const div2 = document.getElementById("drag-divider-2") as HTMLElement;
const sidebarPane = document.getElementById("sidebar-pane") as HTMLElement;
const editorPane = document.getElementById("editor-pane") as HTMLElement;

div1.addEventListener("mousedown", () => { isDragging1 = true; });
div1.addEventListener("touchstart", () => { isDragging1 = true; }, { passive: true });
div2.addEventListener("mousedown", () => { isDragging2 = true; canvasWrapper.style.pointerEvents = "none"; });
div2.addEventListener("touchstart", () => { isDragging2 = true; canvasWrapper.style.pointerEvents = "none"; }, { passive: true });

const handleMove = (clientX: number, clientY: number) => {
  const isMobile = window.innerWidth <= 600;
  if (isDragging1) {
    if (isMobile) {
      const topOffset = document.getElementById("top-bar")?.clientHeight || 56;
      const newHeight = Math.max(100, Math.min(clientY - topOffset, window.innerHeight * 0.4));
      sidebarPane.style.flex = `0 0 ${newHeight}px`;
    } else {
      const newWidth = Math.max(150, Math.min(clientX, window.innerWidth * 0.4));
      sidebarPane.style.flex = `0 0 ${newWidth}px`;
    }
  } else if (isDragging2) {
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

document.querySelectorAll(".section-header").forEach((header) => {
  header.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.tagName === "LABEL") return;
    const treeList = header.nextElementSibling as HTMLElement;
    const actualTree = treeList.tagName === "INPUT" ? (treeList.nextElementSibling as HTMLElement) : treeList;
    if (actualTree && actualTree.classList.contains("tree-list")) {
      actualTree.style.display = actualTree.style.display === "none" ? "block" : "none";
    }
  });
});

const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
let isSidebarOpen = true;
if (btnToggleSidebar) {
  btnToggleSidebar.addEventListener("click", () => {
    isSidebarOpen = !isSidebarOpen;
    sidebarPane.style.display = isSidebarOpen ? "flex" : "none";
    div1.style.display = isSidebarOpen ? "block" : "none";
    resizeCanvas();
  });
}
