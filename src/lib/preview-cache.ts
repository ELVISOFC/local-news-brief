// IndexedDB-backed cache for decoded TTS preview PCM samples.
// Stores Float32Array buffers keyed by `${voice}|${speed}|${text}` so previews
// stay instant across full page reloads, not just SPA navigation.

const DB_NAME = "areanews-tts";
const DB_VERSION = 1;
const STORE = "preview-samples";

type StoredRecord = { key: string; buffer: ArrayBuffer; savedAt: number };

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function loadPreviewSamples(key: string): Promise<Float32Array | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const rec = req.result as StoredRecord | undefined;
        if (!rec?.buffer) return resolve(null);
        resolve(new Float32Array(rec.buffer));
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePreviewSamples(key: string, samples: Float32Array): Promise<void> {
  const db = await openDB();
  if (!db) return;
  // Copy to a standalone ArrayBuffer so we don't persist a view into a larger buffer.
  const buffer = samples.buffer.slice(
    samples.byteOffset,
    samples.byteOffset + samples.byteLength,
  );
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ key, buffer, savedAt: Date.now() } satisfies StoredRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
