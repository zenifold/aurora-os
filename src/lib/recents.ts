// Persistent "recently used" list for the command palette.
// Stored per workspace in localStorage; capped to MAX entries.

export type RecentKind = "task" | "project" | "note" | "page" | "folder" | "contact" | "division" | "nav";

export type RecentItem = {
  kind: RecentKind;
  id: string;
  label: string;
  // optional payload to reconstruct navigation (e.g. project id for tasks)
  meta?: Record<string, string | undefined>;
  ts: number;
};

const MAX = 8;
const KEY = (wsId: string) => `cmd:recents:${wsId}`;

export function getRecents(wsId: string | undefined): RecentItem[] {
  if (!wsId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(wsId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(wsId: string | undefined, item: Omit<RecentItem, "ts">) {
  if (!wsId || typeof window === "undefined") return;
  try {
    const list = getRecents(wsId).filter((r) => !(r.kind === item.kind && r.id === item.id));
    list.unshift({ ...item, ts: Date.now() });
    localStorage.setItem(KEY(wsId), JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore quota errors
  }
}

export function clearRecents(wsId: string | undefined) {
  if (!wsId || typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY(wsId));
  } catch {
    // ignore
  }
}
