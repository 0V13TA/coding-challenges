const DB_NAME = "PixelBasicDB";
const STORE_NAME = "workspace";
const ASSET_STORE = "assets";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // Upgraded to v2

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE, { keyPath: "name" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Source Code Persistence ---
export async function save_basic_code(stateJSON: any): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(stateJSON, "main_file");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to save to IndexedDB", err);
  }
}

export async function load_basic_code(): Promise<any | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get("main_file");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to load from IndexedDB", err);
    return null;
  }
}

// --- Asset Manager Persistence ---
export async function save_asset(asset: {
  name: string;
  type: string;
  data: string;
}): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readwrite");
    const store = tx.objectStore(ASSET_STORE);
    const request = store.put(asset);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function load_all_assets(): Promise<any[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readonly");
    const store = tx.objectStore(ASSET_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function delete_asset(name: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readwrite");
    const store = tx.objectStore(ASSET_STORE);
    const request = store.delete(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
