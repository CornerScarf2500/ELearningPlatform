/**
 * useDownloads — manages "in-app" downloads stored in IndexedDB.
 * "Local" downloads are handled natively by the browser (anchor + download attr).
 *
 * DB: el_downloads
 * Store: downloads  { id, title, url, filetype, blob, size, savedAt }
 */
import { useState, useEffect, useCallback } from "react";

const DB_NAME = "el_downloads";
const STORE = "downloads";
const DB_VERSION = 1;

export interface DownloadItem {
  id: string;          // uuid
  title: string;
  url: string;
  filetype: "video" | "pdf" | "other";
  blob: Blob;
  size: number;        // bytes
  savedAt: string;     // ISO
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAll(): Promise<DownloadItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as DownloadItem[]);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(item: DownloadItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getFiletype(url: string): "video" | "pdf" | "other" {
  const lower = url.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mkv")) return "video";
  if (lower.endsWith(".pdf")) return "pdf";
  return "other";
}

export function useDownloads() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    const all = await dbAll();
    setItems(all.sort((a, b) => (b.savedAt > a.savedAt ? 1 : -1)));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveInApp = useCallback(async (title: string, url: string): Promise<void> => {
    const id = generateId();
    setProgress((p) => new Map(p).set(id, 0));

    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Download failed");

    const total = Number(resp.headers.get("content-length") || 0);
    const reader = resp.body!.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0) setProgress((p) => new Map(p).set(id, Math.round((received / total) * 100)));
    }
    const blob = new Blob(chunks as BlobPart[]);

    const item: DownloadItem = {
      id,
      title,
      url,
      filetype: getFiletype(url),
      blob,
      size: blob.size,
      savedAt: new Date().toISOString(),
    };
    await dbPut(item);
    setProgress((p) => { const m = new Map(p); m.delete(id); return m; });
    await refresh();
  }, [refresh]);

  const deleteItem = useCallback(async (id: string) => {
    await dbDelete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const openItem = useCallback((item: DownloadItem) => {
    const objectUrl = URL.createObjectURL(item.blob);
    window.open(objectUrl, "_blank");
  }, []);

  return { items, loading, progress, saveInApp, deleteItem, openItem, refresh };
}
