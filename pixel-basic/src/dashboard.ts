import JSZip from "jszip";
import { get_projects, create_project, save_file, get_project_files, get_project_assets, save_asset } from "./serialize";
import "./style.css";

const projectList = document.getElementById("project-list") as HTMLElement;
const btnNewProject = document.getElementById("btn-new-project") as HTMLElement;
const importProjectInput = document.getElementById("import-project-input") as HTMLInputElement;

// --- EXPORT LOGIC ---
async function exportProject(projectId: string, projectName: string) {
  const files = await get_project_files(projectId);
  const assets = await get_project_assets(projectId);
  
  const zip = new JSZip();

  // 1. Save metadata
  zip.file("pixel-basic.json", JSON.stringify({ name: projectName, version: 1 }));

  // 2. Add all .basic scripts to the root
  files.forEach(f => {
    zip.file(f.filename, f.content);
  });

  // 3. Add assets into an /assets/ folder as raw binary
  const assetFolder = zip.folder("assets");
  assets.forEach(a => {
    // Strip the "data:image/png;base64," prefix to store raw file data
    const base64Data = a.data.split(",")[1];
    if (base64Data && assetFolder) {
      assetFolder.file(a.name, base64Data, { base64: true });
    }
  });

  // Generate and download the ZIP
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, "_")}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- IMPORT LOGIC ---
if (importProjectInput) {
  importProjectInput.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);

      // Extract Project Name (Fallback to the zip file's name)
      let projectName = file.name.replace(".zip", "");
      if (unzipped.file("pixel-basic.json")) {
        const metaStr = await unzipped.file("pixel-basic.json")!.async("string");
        const meta = JSON.parse(metaStr);
        if (meta.name) projectName = meta.name;
      }

      // Provision a completely new project ID to prevent database collisions
      const newProj = await create_project(`${projectName} (Imported)`);

      // Iterate through everything inside the ZIP
      for (const relativePath of Object.keys(unzipped.files)) {
        const zipEntry = unzipped.files[relativePath];
        if (zipEntry.dir || relativePath === "pixel-basic.json") continue;

        if (relativePath.startsWith("assets/")) {
          const fileName = relativePath.replace("assets/", "");
          const base64Data = await zipEntry.async("base64");
          
          // Reconstruct the Data URL mime type
          let mime = "application/octet-stream";
          if (fileName.endsWith(".png")) mime = "image/png";
          else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) mime = "image/jpeg";
          else if (fileName.endsWith(".ttf")) mime = "font/ttf";
          else if (fileName.endsWith(".otf")) mime = "font/otf";
          else if (fileName.endsWith(".woff")) mime = "font/woff";
          else if (fileName.endsWith(".woff2")) mime = "font/woff2";

          const dataUrl = `data:${mime};base64,${base64Data}`;
          await save_asset(newProj.id, fileName, mime, dataUrl);
        } else {
          // Treat root files as scripts
          const content = await zipEntry.async("string");
          await save_file(newProj.id, relativePath, content);
        }
      }

      initDashboard(); // Refresh UI
    } catch (err) {
      console.error(err);
      alert("Failed to parse project ZIP. Ensure it is a valid Pixel BASIC export.");
    }

    importProjectInput.value = ""; // Reset input
  });
}

// --- DASHBOARD UI ---
async function initDashboard() {
  const projects = await get_projects();
  projectList.innerHTML = "";

  if (projects.length === 0) {
    projectList.innerHTML = "<p>No projects yet. Create one to get started!</p>";
    return;
  }

  // Sort projects so the most recently edited is always first
  projects.sort((a, b) => b.updated_at - a.updated_at);

  for (const proj of projects) {
    const date = new Date(proj.updated_at).toLocaleString();
    const card = document.createElement("div");
    card.className = "project-card";

    card.innerHTML = `
      <h3>${proj.name}</h3>
      <p>Last edited: ${date}</p>
      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <a href="/editor.html?id=${proj.id}" class="control-btn" style="flex: 1; text-decoration: none; text-align: center;">OPEN</a>
        <button class="control-btn export-btn" data-id="${proj.id}" data-name="${proj.name}">⬇ EXPORT</button>
      </div>
    `;
    projectList.appendChild(card);
  }

  // Attach export listeners dynamically
  document.querySelectorAll(".export-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const target = e.target as HTMLButtonElement;
      exportProject(target.getAttribute("data-id")!, target.getAttribute("data-name")!);
    });
  });
}

// Handle creating a new workspace
if (btnNewProject) {
  btnNewProject.addEventListener("click", async (e) => {
    e.preventDefault();
    const name = prompt("Enter project name:", "New Project");
    if (!name) return;
    
    // 1. Create the project record
    const newProj = await create_project(name);
    
    // 2. Seed it with a default entry point file
    const defaultCode = `PRINT "Welcome to ${name}"\n`;
    await save_file(newProj.id, "main.basic", defaultCode);
    
    // 3. Route directly to the new IDE workspace
    window.location.href = `/editor.html?id=${newProj.id}`;
  });
}

// Boot the dashboard
initDashboard();
