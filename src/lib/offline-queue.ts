/**
 * Offline write queue for QuickCapture.
 * Stores pending task inserts in IndexedDB; flushes when the browser reports
 * online state (and on app start). This lets users capture tasks even when
 * the network drops on mobile.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DB_NAME = "aura-offline";
const DB_VERSION = 1;
const STORE = "task-queue";

export interface QueuedTask {
  id: string; // local uuid
  workspace_id: string;
  project_id: string;
  created_by: string;
  title: string;
  status: "todo";
  position: number;
  tags: string[];
  due_date: string | null;
  task_type: string;
  parent_task_id: string | null;
  assignee_ids: string[];
  queued_at: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const r = fn(store);
    if (r instanceof IDBRequest) {
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => reject(r.error);
    } else {
      Promise.resolve(r).then(resolve, reject);
    }
  });
}

export async function enqueueTask(task: Omit<QueuedTask, "id" | "queued_at">): Promise<void> {
  const item: QueuedTask = {
    ...task,
    id: crypto.randomUUID(),
    queued_at: Date.now(),
  };
  await tx("readwrite", (s) => s.put(item));
  notifyChange();
}

export async function listQueued(): Promise<QueuedTask[]> {
  try {
    return await tx<QueuedTask[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedTask[]>);
  } catch {
    return [];
  }
}

async function deleteQueued(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

let flushing = false;
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = await listQueued();
    for (const item of items) {
      try {
        const { id: _localId, queued_at: _qa, ...payload } = item;
        const { error } = await supabase.from("tasks").insert(payload as never);
        if (error) throw error;
        await deleteQueued(item.id);
        ok++;
      } catch {
        failed++;
      }
    }
  } finally {
    flushing = false;
    if (ok > 0) {
      toast.success(`Synced ${ok} offline task${ok === 1 ? "" : "s"}`);
      notifyChange();
    }
  }
  return { ok, failed };
}

const listeners = new Set<() => void>();
function notifyChange() {
  listeners.forEach((l) => l());
}
export function subscribeQueue(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setupOfflineFlush() {
  if (typeof window === "undefined") return;
  const tryFlush = () => {
    if (navigator.onLine) void flushQueue();
  };
  window.addEventListener("online", tryFlush);
  // Also try on visibility regain
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tryFlush();
  });
  // Initial attempt
  setTimeout(tryFlush, 1500);
}
