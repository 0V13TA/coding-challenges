const DB_NAME = "PixelBasicDB";
const PROJECTS_STORE = "projects";
const FILES_STORE = "files";
const ASSETS_STORE = "assets";

export interface Project {
  id: string;
  name: string;
  updated_at: number;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  filename: string;
  content: any; // CodeMirror state JSON or raw string
}

export interface Asset {
  id: string;
  project_id: string;
  name: string;
  type: string;
  data: string; // Base64 string
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3); // Bumped to v3

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // 1. Projects Store
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
      }

      // 2. Files Store (Indexed by project_id)
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const fileStore = db.createObjectStore(FILES_STORE, { keyPath: "id" });
        fileStore.createIndex("project_id", "project_id", { unique: false });
      }

      // 3. Assets Store (Wipe old v2 flat store and rebuild as relational)
      if (db.objectStoreNames.contains(ASSETS_STORE)) {
        db.deleteObjectStore(ASSETS_STORE);
      }
      const assetStore = db.createObjectStore(ASSETS_STORE, { keyPath: "id" });
      assetStore.createIndex("project_id", "project_id", { unique: false });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// 1. PROJECT MANAGEMENT
// ==========================================

export async function get_projects(): Promise<Project[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const request = tx.objectStore(PROJECTS_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function create_project(name: string): Promise<Project> {
  const db = await getDB();
  const project: Project = {
    id: crypto.randomUUID(), // Native browser UUID generation
    name,
    updated_at: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    const request = tx.objectStore(PROJECTS_STORE).put(project);
    request.onsuccess = () => resolve(project);
    request.onerror = () => reject(request.error);
  });
}

export async function update_project_timestamp(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readwrite");
    const store = tx.objectStore(PROJECTS_STORE);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      if (getReq.result) {
        const project = getReq.result as Project;
        project.updated_at = Date.now();
        store.put(project);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ==========================================
// 2. FILE MANAGEMENT
// ==========================================

export async function save_file(
  project_id: string,
  filename: string,
  content: any
): Promise<void> {
  const db = await getDB();
  const file: ProjectFile = {
    id: `${project_id}_${filename}`, // Compound primary key
    project_id,
    filename,
    content,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readwrite");
    const request = tx.objectStore(FILES_STORE).put(file);
    request.onsuccess = () => {
      update_project_timestamp(project_id); // Keep dashboard sorted by recent
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function get_project_files(project_id: string): Promise<ProjectFile[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readonly");
    const index = tx.objectStore(FILES_STORE).index("project_id");
    const request = index.getAll(project_id);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function delete_file(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readwrite");
    const request = tx.objectStore(FILES_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function rename_file(project_id: string, old_filename: string, new_filename: string, content: any): Promise<void> {
  await delete_file(`${project_id}_${old_filename}`);
  await save_file(project_id, new_filename, content);
}


// ==========================================
// 3. ASSET MANAGEMENT
// ==========================================

export async function save_asset(
  project_id: string,
  name: string,
  type: string,
  data: string
): Promise<void> {
  const db = await getDB();
  const asset: Asset = {
    id: `${project_id}_${name}`,
    project_id,
    name,
    type,
    data,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS_STORE, "readwrite");
    const request = tx.objectStore(ASSETS_STORE).put(asset);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function get_project_assets(project_id: string): Promise<Asset[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const storeTx = db.transaction(ASSETS_STORE, "readonly");
    const index = storeTx.objectStore(ASSETS_STORE).index("project_id");
    const request = index.getAll(project_id);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function delete_asset(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS_STORE, "readwrite");
    const request = tx.objectStore(ASSETS_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function rename_asset(project_id: string, old_name: string, new_name: string, type: string, data: string): Promise<void> {
  await delete_asset(`${project_id}_${old_name}`);
  await save_asset(project_id, new_name, type, data);
}
