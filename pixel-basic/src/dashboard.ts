import { get_projects, create_project, save_file, get_project_files, get_project_assets, save_asset } from "./serialize";
import "./style.css";

const projectList = document.getElementById("project-list") as HTMLElement;
const btnNewProject = document.getElementById("btn-new-project") as HTMLElement;
const importProjectInput = document.getElementById("import-project-input") as HTMLInputElement;

async function exportProject(projectId: string, projectName: string) {
  const files = await get_project_files(projectId);
  const assets = await get_project_assets(projectId);

  const payload = JSON.stringify({
    project: { name: projectName },
    files,
    assets
  });

  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, "_")}_export.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function initDashboard() {
  const projects = await get_projects();
  projectList.innerHTML = "";

  if (projects.length === 0) {
    projectList.innerHTML = "<p>No projects yet. Create one to get started!</p>";
    return;
  }

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

// Handle Importing an existing workspace
if (importProjectInput) {
  importProjectInput.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);

        // Provision a completely new project ID to prevent database collisions
        const newProj = await create_project(`${data.project.name} (Imported)`);

        for (const f of data.files) {
          await save_file(newProj.id, f.filename, f.content);
        }
        for (const a of data.assets) {
          await save_asset(newProj.id, a.name, a.type, a.data);
        }

        initDashboard(); // Refresh UI
      } catch (err) {
        alert("Failed to parse project file. Ensure it is a valid Pixel BASIC export.");
      }
    };
    reader.readAsText(file);
    importProjectInput.value = ""; // Reset input
  });
}

// Handle creating a new workspace
if (btnNewProject) {
  btnNewProject.addEventListener("click", async (e) => {
    e.preventDefault();
    const name = prompt("Enter project name:", "New Project");
    if (!name) return;

    const newProj = await create_project(name);
    const defaultCode = `PRINT "Welcome to ${name}"\n`;
    await save_file(newProj.id, "main.basic", defaultCode);
    window.location.href = `/editor.html?id=${newProj.id}`;
  });
}

initDashboard();
