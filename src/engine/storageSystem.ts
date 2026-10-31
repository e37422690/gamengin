import {
  ENGINE_VERSION,
  GameProject,
  SCHEMA_VERSION,
  StorageStatus,
} from '../types/engine';

const DB_NAME = 'KareForge2D_LocalDB';
const DB_VERSION = 2;
const STORE_PROJECTS = 'projects';
const STORE_BLOBS = 'asset_blobs';

const memoryProjects = new Map<string, GameProject>();
const memoryBlobs = new Map<string, ArrayBuffer>();
let simulatedStorageFailure = false;

export function setSimulatedStorageFailure(fail: boolean): void {
  simulatedStorageFailure = fail;
}

export function sanitizeSvgContent(rawSvg: string): string {
  return rawSvg
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}

export function migrateProjectData(raw: unknown): GameProject {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Geçersiz proje verisi: JSON nesnesi bekleniyordu.');
  }
  const data = raw as Record<string, unknown>;
  if (typeof data.id !== 'string' || typeof data.name !== 'string' || !Array.isArray(data.scenes)) {
    throw new Error('Bozuk proje dosyası: id, name veya scenes alanları eksik.');
  }

  const migrated: GameProject = JSON.parse(JSON.stringify(data));

  if (!migrated.schemaVersion || migrated.schemaVersion < SCHEMA_VERSION) {
    migrated.schemaVersion = SCHEMA_VERSION;
  }
  if (!migrated.engineVersion) {
    migrated.engineVersion = ENGINE_VERSION;
  }
  if (!migrated.variables) {
    migrated.variables = [];
  }
  if (!migrated.assets) {
    migrated.assets = [];
  }
  if (!migrated.settings) {
    migrated.settings = {
      resolutionWidth: 960,
      resolutionHeight: 540,
      targetFps: 60,
      pixelArtMode: false,
      defaultVolume: 80,
      touchControlsEnabled: true,
      author: 'Yerel Geliştirici',
      license: 'MIT',
    };
  }
  for (const scene of migrated.scenes) {
    if (!scene.layers || scene.layers.length === 0) {
      scene.layers = [
        { id: 'layer_main', name: 'Oyun Alanı', visible: true, locked: false, order: 1, parallaxFactor: 1 },
      ];
    }
    if (!scene.blocks) scene.blocks = [];
    if (!scene.dialogues) scene.dialogues = [];
    if (!scene.quests) scene.quests = [];
  }

  return migrated;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB açılamadı.'));
  });
}

export async function saveProjectToStorage(project: GameProject): Promise<void> {
  if (simulatedStorageFailure) {
    throw new Error('Depolama yazma hatası: Kota aşıldı veya disk erişimi reddedildi.');
  }

  const validated = migrateProjectData({
    ...project,
    updatedAt: new Date().toISOString(),
  });

  memoryProjects.set(validated.id, validated);

  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS], 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    store.put(validated);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Proje IndexedDB üzerine kaydedilemedi.'));
    };
  });
}

export async function loadProjectFromStorage(projectId: string): Promise<GameProject | null> {
  const db = await openDatabase();
  if (!db) {
    const mem = memoryProjects.get(projectId);
    return mem ? migrateProjectData(mem) : null;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS], 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.get(projectId);
    req.onsuccess = () => {
      db.close();
      if (!req.result) {
        const mem = memoryProjects.get(projectId);
        resolve(mem ? migrateProjectData(mem) : null);
        return;
      }
      try {
        resolve(migrateProjectData(req.result));
      } catch (err) {
        reject(err);
      }
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error('Proje yüklenirken okuma hatası oluştu.'));
    };
  });
}

export async function listProjectsFromStorage(): Promise<GameProject[]> {
  const db = await openDatabase();
  if (!db) {
    return Array.from(memoryProjects.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS], 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const list: GameProject[] = [];
      for (const item of req.result || []) {
        try {
          list.push(migrateProjectData(item));
        } catch {
          // Bozuk kayıtları atla ama silme
        }
      }
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      resolve(list);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error('Proje listesi okunamadı.'));
    };
  });
}

export async function deleteProjectFromStorage(projectId: string): Promise<void> {
  memoryProjects.delete(projectId);
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS], 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(projectId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Proje silinemedi.'));
    };
  });
}

export async function saveAssetBinaryToStorage(
  assetId: string,
  buffer: ArrayBuffer
): Promise<void> {
  if (simulatedStorageFailure) {
    throw new Error('İkili varlık kaydedilemedi: Depolama hatası.');
  }
  memoryBlobs.set(assetId, buffer);
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_BLOBS).put(buffer, assetId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Varlık ikili verisi kaydedilemedi.'));
    };
  });
}

export async function loadAssetBinaryFromStorage(
  assetId: string
): Promise<ArrayBuffer | null> {
  const db = await openDatabase();
  if (!db) {
    return memoryBlobs.get(assetId) || null;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_BLOBS], 'readonly');
    const req = tx.objectStore(STORE_BLOBS).get(assetId);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as ArrayBuffer) || memoryBlobs.get(assetId) || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function estimateStorageQuota(): Promise<
  Pick<StorageStatus, 'usedBytes' | 'quotaBytes' | 'persisted'>
> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted
        ? await navigator.storage.persisted()
        : false;
      return {
        usedBytes: est.usage || 0,
        quotaBytes: est.quota || 50 * 1024 * 1024,
        persisted,
      };
    } catch {
      // Fallback
    }
  }
  let approx = 0;
  for (const p of memoryProjects.values()) {
    approx += JSON.stringify(p).length;
  }
  for (const b of memoryBlobs.values()) {
    approx += b.byteLength;
  }
  return {
    usedBytes: approx,
    quotaBytes: 50 * 1024 * 1024,
    persisted: false,
  };
}
