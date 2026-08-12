/**
 * Strategy Canvas starter templates — project-level visual artifacts:
 * phase mind-map, RACI grid, risk matrix. Returns Excalidraw element arrays
 * compatible with `CANVAS_TEMPLATES` in canvas-templates.ts.
 *
 * Pure functions (no imports, no side effects) so they work in any bundle.
 */

export type StrategyTemplateId =
  | "phase-mind-map"
  | "raci"
  | "risk-matrix"
  | "dependency-sketch"
  | "retro";

export interface StrategyTemplate {
  id: StrategyTemplateId;
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
  fontSize?: number;
}

function box({
  x,
  y,
  w = 200,
  h = 80,
  fill = "transparent",
  stroke = "#1e1e1e",
  shape = "rectangle",
  text = "",
  fontSize = 18,
}: BoxOpts): Record<string, unknown>[] {
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
      x: x + 10,
      y: y + h / 2 - fontSize / 2,
      width: w - 20,
      height: fontSize + 4,
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
      fontSize,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      baseline: fontSize,
      containerId: id,
      originalText: text,
      autoResize: true,
      lineHeight: 1.25,
    });
    (base.boundElements as { id: string; type: string }[]).push({
      id: labelId,
      type: "text",
    });
  }
  return out;
}

function line(
  fromId: string,
  toId: string,
  points: [number, number][],
): Record<string, unknown> {
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
    endArrowhead: null,
    elbowed: false,
  };
}

function phaseMindMap(): Record<string, unknown>[] {
  const center = box({
    x: 460,
    y: 280,
    w: 220,
    h: 90,
    text: "Project",
    shape: "ellipse",
    fill: "#fff3bf",
    fontSize: 22,
  });
  const phases = [
    { label: "Discovery", x: 80, y: 80, fill: "#e7f5ff" },
    { label: "Design", x: 880, y: 80, fill: "#e7f5ff" },
    { label: "Build", x: 80, y: 480, fill: "#d3f9d8" },
    { label: "Launch", x: 880, y: 480, fill: "#ffe3e3" },
  ];
  const out: Record<string, unknown>[] = [...center];
  const cid = center[0].id as string;
  phases.forEach((p) => {
    const b = box({ x: p.x, y: p.y, text: p.label, fill: p.fill });
    out.push(...b);
    out.push(
      line(cid, b[0].id as string, [
        [570, 325],
        [p.x + 100, p.y + 40],
      ]),
    );
  });
  return out;
}

function raci(): Record<string, unknown>[] {
  const cols = ["Task", "Responsible", "Accountable", "Consulted", "Informed"];
  const rows = ["Define scope", "Build prototype", "Review with client", "Ship"];
  const out: Record<string, unknown>[] = [];
  const COL_W = 180;
  const ROW_H = 60;
  cols.forEach((c, i) => {
    out.push(
      ...box({
        x: 80 + i * COL_W,
        y: 80,
        w: COL_W,
        h: ROW_H,
        text: c,
        fill: "#f1f3f5",
        fontSize: 16,
      }),
    );
  });
  rows.forEach((r, ri) => {
    out.push(
      ...box({
        x: 80,
        y: 80 + (ri + 1) * ROW_H,
        w: COL_W,
        h: ROW_H,
        text: r,
        fill: "#fff",
        fontSize: 14,
      }),
    );
    for (let ci = 1; ci < cols.length; ci++) {
      out.push(
        ...box({
          x: 80 + ci * COL_W,
          y: 80 + (ri + 1) * ROW_H,
          w: COL_W,
          h: ROW_H,
          text: "",
          fill: "#fff",
        }),
      );
    }
  });
  return out;
}

function riskMatrix(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  // Axes labels
  out.push(
    ...box({
      x: 60,
      y: 40,
      w: 600,
      h: 40,
      text: "Risk matrix — Impact ↑   Likelihood →",
      fill: "transparent",
      fontSize: 16,
    }),
  );
  // 3x3 grid: rows = impact (high→low), cols = likelihood (low→high)
  const colors = [
    ["#fff", "#fff3bf", "#ffe3e3"],
    ["#fff", "#fff3bf", "#ffe3e3"],
    ["#d3f9d8", "#fff", "#fff3bf"],
  ];
  const labels = [
    ["", "", "Critical"],
    ["", "", ""],
    ["", "", ""],
  ];
  const CELL = 200;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push(
        ...box({
          x: 120 + c * CELL,
          y: 120 + r * CELL,
          w: CELL,
          h: CELL,
          fill: colors[r][c],
          text: labels[r][c],
          fontSize: 14,
        }),
      );
    }
  }
  return out;
}

function dependencySketch(): Record<string, unknown>[] {
  const a = box({ x: 80, y: 200, text: "Upstream A", fill: "#e7f5ff" });
  const b = box({ x: 80, y: 380, text: "Upstream B", fill: "#e7f5ff" });
  const c = box({ x: 420, y: 290, text: "Our work", fill: "#fff3bf" });
  const d = box({ x: 760, y: 200, text: "Downstream X", fill: "#d3f9d8" });
  const e = box({ x: 760, y: 380, text: "Downstream Y", fill: "#d3f9d8" });
  const all = [...a, ...b, ...c, ...d, ...e];
  all.push(
    line(a[0].id as string, c[0].id as string, [
      [280, 240],
      [420, 330],
    ]),
    line(b[0].id as string, c[0].id as string, [
      [280, 420],
      [420, 330],
    ]),
    line(c[0].id as string, d[0].id as string, [
      [620, 330],
      [760, 240],
    ]),
    line(c[0].id as string, e[0].id as string, [
      [620, 330],
      [760, 420],
    ]),
  );
  return all;
}

function retro(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const cols = [
    { label: "Went well", fill: "#d3f9d8" },
    { label: "Could improve", fill: "#fff3bf" },
    { label: "Action items", fill: "#e7f5ff" },
  ];
  cols.forEach((c, i) => {
    out.push(
      ...box({
        x: 80 + i * 320,
        y: 80,
        w: 300,
        h: 60,
        text: c.label,
        fill: c.fill,
        fontSize: 18,
      }),
    );
    out.push(
      ...box({
        x: 80 + i * 320,
        y: 160,
        w: 300,
        h: 400,
        fill: "transparent",
        text: "",
      }),
    );
  });
  return out;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "phase-mind-map",
    label: "Phase mind-map",
    description: "Project at the center with phases branching out",
    icon: "🧭",
    build: phaseMindMap,
  },
  {
    id: "raci",
    label: "RACI matrix",
    description: "Who's responsible, accountable, consulted, informed",
    icon: "📋",
    build: raci,
  },
  {
    id: "risk-matrix",
    label: "Risk matrix",
    description: "3×3 impact vs. likelihood grid",
    icon: "⚠️",
    build: riskMatrix,
  },
  {
    id: "dependency-sketch",
    label: "Dependency sketch",
    description: "Upstream → us → downstream",
    icon: "🔗",
    build: dependencySketch,
  },
  {
    id: "retro",
    label: "Retro board",
    description: "Went well · Could improve · Action items",
    icon: "🪞",
    build: retro,
  },
];
