export interface PlanItem {
  id: string;
  title: string;
  lane: string;
  start: string; // ISO date YYYY-MM-DD
  end: string; // ISO date YYYY-MM-DD
  status?: "todo" | "in_progress" | "done" | "blocked";
  deps?: string[];
  color?: string;
  kind?: "task" | "milestone";
}

export interface PlanLane {
  id: string;
  name: string;
  color?: string;
}

export interface PlanView {
  zoom?: number; // px per day (column width)
  laneOrder?: string[]; // explicit ordering, takes precedence over lanes order
  snapDays?: number; // snap step in days for drag/resize, 0 means free (no snap)
  autoCascade?: boolean; // when true, moving an item pushes overlapping successors
  showCriticalPath?: boolean; // highlight the longest dependency chain
}

/**
 * Compute the set of item ids on the critical (longest by duration) path through deps.
 */
export function criticalPathIds(items: PlanItem[]): Set<string> {
  const DAY = 86400000;
  const dur = (it: PlanItem) => {
    const s = Date.parse(it.start);
    const e = Date.parse(it.end);
    if (Number.isNaN(s) || Number.isNaN(e)) return 0;
    return Math.max(1, Math.round((e - s) / DAY) + 1);
  };
  const byId = new Map(items.map((i) => [i.id, i]));
  const memoLen = new Map<string, number>();
  const memoNext = new Map<string, string | null>();
  // successors map: from -> [to ids that depend on from]
  const succ = new Map<string, string[]>();
  for (const it of items) {
    for (const d of it.deps ?? []) {
      if (!succ.has(d)) succ.set(d, []);
      succ.get(d)!.push(it.id);
    }
  }
  const longest = (id: string): number => {
    if (memoLen.has(id)) return memoLen.get(id)!;
    const it = byId.get(id);
    if (!it) return 0;
    const base = dur(it);
    let best = base;
    let bestNext: string | null = null;
    for (const s of succ.get(id) ?? []) {
      const v = base + longest(s);
      if (v > best) {
        best = v;
        bestNext = s;
      }
    }
    memoLen.set(id, best);
    memoNext.set(id, bestNext);
    return best;
  };
  let startId: string | null = null;
  let bestLen = 0;
  for (const it of items) {
    const v = longest(it.id);
    if (v > bestLen) {
      bestLen = v;
      startId = it.id;
    }
  }
  const out = new Set<string>();
  let cur = startId;
  while (cur) {
    out.add(cur);
    cur = memoNext.get(cur) ?? null;
  }
  return out;
}

/**
 * Cascade: if a predecessor moved, push successors that now overlap.
 * Returns updated items list.
 */
export function cascadeForward(items: PlanItem[], changedId: string): PlanItem[] {
  const DAY = 86400000;
  const map = new Map(items.map((i) => [i.id, { ...i }]));
  const succ = new Map<string, string[]>();
  for (const it of items) {
    for (const d of it.deps ?? []) {
      if (!succ.has(d)) succ.set(d, []);
      succ.get(d)!.push(it.id);
    }
  }
  const queue = [changedId];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const cur = map.get(id);
    if (!cur) continue;
    const curEnd = Date.parse(cur.end);
    for (const sId of succ.get(id) ?? []) {
      const s = map.get(sId);
      if (!s) continue;
      const sStart = Date.parse(s.start);
      const sEnd = Date.parse(s.end);
      if (Number.isNaN(curEnd) || Number.isNaN(sStart) || Number.isNaN(sEnd)) continue;
      const minStart = curEnd + DAY;
      if (sStart < minStart) {
        const dur = sEnd - sStart;
        const nStart = minStart;
        const nEnd = nStart + dur;
        s.start = new Date(nStart).toISOString().slice(0, 10);
        s.end = new Date(nEnd).toISOString().slice(0, 10);
        queue.push(sId);
      }
    }
  }
  return Array.from(map.values());
}

export interface PlanContent {
  type: "plan";
  lanes: PlanLane[];
  items: PlanItem[];
  view?: PlanView;
}

export const EMPTY_PLAN: PlanContent = {
  type: "plan",
  lanes: [
    { id: "lane-1", name: "Discovery" },
    { id: "lane-2", name: "Build" },
    { id: "lane-3", name: "Launch" },
  ],
  items: [],
  view: { zoom: 36 },
};

export function isPlanContent(v: unknown): v is PlanContent {
  return !!v && typeof v === "object" && (v as { type?: string }).type === "plan";
}

/**
 * Returns true if adding `from -> to` dependency would create a cycle.
 */
export function wouldCreateCycle(items: PlanItem[], from: string, to: string): boolean {
  if (from === to) return true;
  const map = new Map(items.map((i) => [i.id, i.deps ?? []]));
  // DFS from `to` following deps; if we reach `from`, cycle.
  const stack = [to];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const d of map.get(cur) ?? []) stack.push(d);
  }
  return false;
}
