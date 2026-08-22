import JSZip from "jszip";
import { create_project, save_file, save_asset } from "./serialize";
import "./style.css";

const marketList = document.getElementById("market-list") as HTMLElement;

async function installProject(filename: string, projectName: string) {
  try {
    // 1. Fetch the zip file from our static folder
    const response = await fetch(`/market/${filename}`);
    if (!response.ok) throw new Error("Failed to fetch project zip.");
    
    const blob = await response.blob();
    const zip = new JSZip();
    const unzipped = await zip.loadAsync(blob);

    // 2. Provision a new local project
    const newProj = await create_project(`${projectName}`);

    // 3. Unpack and save
    for (const relativePath of Object.keys(unzipped.files)) {
      const zipEntry = unzipped.files[relativePath];
      if (zipEntry.dir || relativePath === "pixel-basic.json") continue;

      if (relativePath.startsWith("assets/")) {
        const fName = relativePath.replace("assets/", "");
        const base64Data = await zipEntry.async("base64");
        
        let mime = "application/octet-stream";
        if (fName.endsWith(".png")) mime = "image/png";
        else if (fName.endsWith(".jpg") || fName.endsWith(".jpeg")) mime = "image/jpeg";
        else if (fName.endsWith(".ttf")) mime = "font/ttf";
        else if (fName.endsWith(".otf")) mime = "font/otf";

        const dataUrl = `data:${mime};base64,${base64Data}`;
        await save_asset(newProj.id, fName, mime, dataUrl);
      } else {
        const content = await zipEntry.async("string");
        await save_file(newProj.id, relativePath, content);
      }
    }

    // 4. Redirect to the newly installed project
    window.location.href = `/editor.html?id=${newProj.id}`;

  } catch (err: any) {
    alert(`Installation failed: ${err.message}`);
  }
}

async function initMarketplace() {
  try {
    const res = await fetch("/market/registry.json");
    const registry = await res.json();

    marketList.innerHTML = "";

    if (registry.length === 0) {
      marketList.innerHTML = "<p>No projects in the marketplace yet.</p>";
      return;
    }

    for (const item of registry) {
      const card = document.createElement("div");
      card.className = "project-card";

      card.innerHTML = `
        <h3>${item.name}</h3>
        <span class="meta-text">By ${item.author}</span>
        <p>${item.description}</p>
        <button class="control-btn play-btn install-btn" data-filename="${item.filename}" data-name="${item.name}" style="margin-top: 10px;">⬇ INSTALL PROJECT</button>
      `;
      marketList.appendChild(card);
    }

    document.querySelectorAll(".install-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLButtonElement;
        const originalText = target.textContent;
        target.textContent = "INSTALLING...";
        target.disabled = true;
        
        installProject(target.getAttribute("data-filename")!, target.getAttribute("data-name")!)
          .finally(() => {
            target.textContent = originalText;
            target.disabled = false;
          });
      });
    });

  } catch (err) {
    marketList.innerHTML = `<p style="color: #f38ba8;">Failed to load marketplace registry. Ensure /public/market/registry.json exists.</p>`;
  }
}

initMarketplace();
