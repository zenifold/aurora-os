/**
 * Starter templates for visual canvas pages. Each template returns a fresh
 * array of Excalidraw element objects positioned at sensible defaults.
 *
 * Keep this file pure (no imports, no side effects) so it stays cheap and
 * works in both server and client bundles.
 */

export type CanvasTemplateId =
  | "flowchart"
  | "user-journey"
  | "system-arch"
  | "wireframe-mobile"
  | "mind-map";

export interface CanvasTemplate {
  id: CanvasTemplateId;
  label: string;
  description: string;
  icon: string;
  build: () => Record<string, unknown>[];
}

function rid() {
  return Math.random().toString(36).slice(2, 11);
}

interface BoxOpts {
  x: number;
  y: number;
  w?: number;
  h?: number;
  fill?: string;
  stroke?: string;
  shape?: "rectangle" | "ellipse" | "diamond";
  text?: string;
}

function box({ x, y, w = 200, h = 80, fill = "transparent", stroke = "#1e1e1e", shape = "rectangle", text = "" }: BoxOpts): Record<string, unknown>[] {
  const id = rid();
  const base: Record<string, unknown> = {
    id,
    type: shape,
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: stroke,
    backgroundColor: fill,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: shape === "rectangle" ? { type: 3 } : null,
    seed: Math.floor(Math.random() * 1_000_000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 1_000_000),
    isDeleted: false,
    boundElements: [] as { id: string; type: string }[],
    updated: Date.now(),
    link: null,
    locked: false,
  };
  const out: Record<string, unknown>[] = [base];
  if (text) {
    const labelId = rid();
    out.push({
      id: labelId,
      type: "text",
      x: x + w / 2 - 60,
      y: y + h / 2 - 12,
      width: 120,
      height: 24,
      angle: 0,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: Math.floor(Math.random() * 1_000_000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1_000_000),
      isDeleted: false,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
      text,
      fontSize: 18,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      baseline: 18,
      containerId: id,
      originalText: text,
      autoResize: true,
      lineHeight: 1.25,
    });
    (base.boundElements as { id: string; type: string }[]).push({ id: labelId, type: "text" });
  }
  return out;
}

function arrow(fromId: string, toId: string, points: [number, number][]): Record<string, unknown> {
  return {
    id: rid(),
    type: "arrow",
    x: points[0][0],
    y: points[0][1],
    width: Math.abs(points[points.length - 1][0] - points[0][0]) || 10,
    height: Math.abs(points[points.length - 1][1] - points[0][1]) || 10,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 2 },
    seed: Math.floor(Math.random() * 1_000_000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 1_000_000),
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    points: points.map(([px, py]) => [px - points[0][0], py - points[0][1]]),
    lastCommittedPoint: null,
    startBinding: { elementId: fromId, focus: 0, gap: 4 },
    endBinding: { elementId: toId, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  };
}

function flowchart(): Record<string, unknown>[] {
  const a = box({ x: 100, y: 80, text: "Start", shape: "ellipse", fill: "#d3f9d8" });
  const b = box({ x: 100, y: 240, text: "Do work" });
  const c = box({ x: 100, y: 400, text: "Decision", shape: "diamond", fill: "#fff3bf" });
  const d = box({ x: 100, y: 580, text: "Done", shape: "ellipse", fill: "#e7f5ff" });
  const all = [...a, ...b, ...c, ...d];
  all.push(
    arrow(a[0].id as string, b[0].id as string, [[200, 160], [200, 240]]),
    arrow(b[0].id as string, c[0].id as string, [[200, 320], [200, 400]]),
    arrow(c[0].id as string, d[0].id as string, [[200, 480], [200, 580]]),
  );
  return all;
}

function userJourney(): Record<string, unknown>[] {
  const stages = ["Discover", "Sign up", "Onboard", "First action", "Retain"];
  const out: Record<string, unknown>[] = [];
  const ids: string[] = [];
  stages.forEach((label, i) => {
    const b = box({ x: 60 + i * 240, y: 200, w: 180, h: 80, text: label, fill: "#e7f5ff" });
    out.push(...b);
    ids.push(b[0].id as string);
  });
  for (let i = 0; i < ids.length - 1; i++) {
    out.push(arrow(ids[i], ids[i + 1], [[60 + i * 240 + 180, 240], [60 + (i + 1) * 240, 240]]));
  }
  return out;
}

function systemArch(): Record<string, unknown>[] {
  const client = box({ x: 60, y: 240, text: "Web client", fill: "#e7f5ff" });
  const api = box({ x: 360, y: 240, text: "API gateway", fill: "#fff3bf" });
  const svc1 = box({ x: 660, y: 100, text: "Auth service", fill: "#d3f9d8" });
  const svc2 = box({ x: 660, y: 240, text: "Core service", fill: "#d3f9d8" });
  const svc3 = box({ x: 660, y: 380, text: "Billing service", fill: "#d3f9d8" });
  const db = box({ x: 960, y: 240, text: "Postgres", shape: "ellipse", fill: "#ffe3e3" });
  const all = [...client, ...api, ...svc1, ...svc2, ...svc3, ...db];
  all.push(
    arrow(client[0].id as string, api[0].id as string, [[260, 280], [360, 280]]),
    arrow(api[0].id as string, svc1[0].id as string, [[560, 280], [660, 140]]),
    arrow(api[0].id as string, svc2[0].id as string, [[560, 280], [660, 280]]),
    arrow(api[0].id as string, svc3[0].id as string, [[560, 280], [660, 420]]),
    arrow(svc2[0].id as string, db[0].id as string, [[860, 280], [960, 280]]),
  );
  return all;
}

function wireframeMobile(): Record<string, unknown>[] {
  const frame = box({ x: 200, y: 60, w: 280, h: 560, text: "" });
  const header = box({ x: 220, y: 80, w: 240, h: 60, text: "Header", fill: "#f1f3f5" });
  const hero = box({ x: 220, y: 160, w: 240, h: 140, text: "Hero / banner", fill: "#e7f5ff" });
  const cta = box({ x: 220, y: 320, w: 240, h: 50, text: "CTA button", fill: "#d3f9d8" });
  const list1 = box({ x: 220, y: 390, w: 240, h: 60, text: "List item 1" });
  const list2 = box({ x: 220, y: 460, w: 240, h: 60, text: "List item 2" });
  const tab = box({ x: 220, y: 560, w: 240, h: 50, text: "Tab bar", fill: "#f1f3f5" });
  return [...frame, ...header, ...hero, ...cta, ...list1, ...list2, ...tab];
}

function mindMap(): Record<string, unknown>[] {
  const center = box({ x: 460, y: 280, w: 200, h: 80, text: "Idea", shape: "ellipse", fill: "#fff3bf" });
  const a = box({ x: 80, y: 100, text: "Branch A", fill: "#e7f5ff" });
  const b = box({ x: 880, y: 100, text: "Branch B", fill: "#e7f5ff" });
  const c = box({ x: 80, y: 460, text: "Branch C", fill: "#e7f5ff" });
  const d = box({ x: 880, y: 460, text: "Branch D", fill: "#e7f5ff" });
  const all = [...center, ...a, ...b, ...c, ...d];
  const cid = center[0].id as string;
  all.push(
    arrow(cid, a[0].id as string, [[460, 320], [280, 140]]),
    arrow(cid, b[0].id as string, [[660, 320], [880, 140]]),
    arrow(cid, c[0].id as string, [[460, 360], [280, 500]]),
    arrow(cid, d[0].id as string, [[660, 360], [880, 500]]),
  );
  return all;
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  { id: "flowchart", label: "Flowchart", description: "Start → step → decision → done", icon: "🔀", build: flowchart },
  { id: "user-journey", label: "User journey", description: "5 stage horizontal flow", icon: "🚶", build: userJourney },
  { id: "system-arch", label: "System architecture", description: "Client → API → services → DB", icon: "🏗️", build: systemArch },
  { id: "wireframe-mobile", label: "Mobile wireframe", description: "Phone frame with hero, CTA, list", icon: "📱", build: wireframeMobile },
  { id: "mind-map", label: "Mind map", description: "Central idea with 4 branches", icon: "🧠", build: mindMap },
];
