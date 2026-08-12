import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * AI tools for visual canvas pages (Excalidraw scenes).
 *
 * - generateCanvas: drafts a new scene from a prompt (used when creating a canvas page)
 * - improveCanvas: edits an existing scene given current elements + an instruction
 *
 * The AI returns Excalidraw element JSON which is rendered (and editable!) in the
 * client via @excalidraw/excalidraw. We coerce the AI's loose output into valid
 * elements with sane defaults so partial responses still render.
 */

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

async function getApiKey(workspaceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("workspace_ai_secrets")
    .select("openrouter_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data?.openrouter_api_key ?? null;
}

interface RawEl {
  type?: string;
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  roughness?: number;
  strokeWidth?: number;
  roundness?: { type: number } | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  points?: [number, number][];
  label?: { text?: string };
  containerId?: string | null;
  [k: string]: unknown;
}

const ALLOWED_TYPES = new Set([
  "rectangle",
  "ellipse",
  "diamond",
  "text",
  "arrow",
  "line",
  "freedraw",
]);

function rid() {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Coerce loose AI output into a valid Excalidraw element list.
 * Auto-creates IDs, fills defaults, and synthesizes label text elements
 * for shapes that came in with a `label.text` field.
 */
function normalizeElements(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  const out: Record<string, unknown>[] = [];
  const idMap = new Map<string, string>();

  // First pass: assign IDs
  const inputs = raw.filter((e): e is RawEl => !!e && typeof e === "object").map((e) => {
    const original = String(e.id ?? "");
    const id = original || rid();
    if (original && original !== id) idMap.set(original, id);
    if (original) idMap.set(original, id);
    return { ...e, id };
  });

  for (const el of inputs) {
    const type = ALLOWED_TYPES.has(String(el.type)) ? String(el.type) : "rectangle";
    const base = {
      id: el.id,
      type,
      x: Number.isFinite(el.x) ? Number(el.x) : 0,
      y: Number.isFinite(el.y) ? Number(el.y) : 0,
      width: Number.isFinite(el.width) ? Number(el.width) : 160,
      height: Number.isFinite(el.height) ? Number(el.height) : 80,
      angle: 0,
      strokeColor: typeof el.strokeColor === "string" ? el.strokeColor : "#1e1e1e",
      backgroundColor: typeof el.backgroundColor === "string" ? el.backgroundColor : "transparent",
      fillStyle: typeof el.fillStyle === "string" ? el.fillStyle : "solid",
      strokeWidth: Number.isFinite(el.strokeWidth) ? Number(el.strokeWidth) : 2,
      strokeStyle: "solid",
      roughness: Number.isFinite(el.roughness) ? Number(el.roughness) : 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: type === "rectangle" ? { type: 3 } : null,
      seed: Math.floor(Math.random() * 1_000_000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1_000_000),
      isDeleted: false,
      boundElements: [] as { id: string; type: string }[],
      updated: Date.now(),
      link: null,
      locked: false,
    };

    if (type === "text") {
      const text = String(el.text ?? "");
      const fontSize = Number.isFinite(el.fontSize) ? Number(el.fontSize) : 20;
      out.push({
        ...base,
        text,
        fontSize,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        baseline: fontSize,
        containerId: el.containerId ? idMap.get(el.containerId) ?? el.containerId : null,
        originalText: text,
        autoResize: true,
        lineHeight: 1.25,
      });
      continue;
    }

    if (type === "arrow" || type === "line") {
      const points = Array.isArray(el.points) && el.points.length >= 2
        ? el.points
        : [
            [0, 0],
            [Number(base.width) || 100, 0],
          ];
      const startId = el.startBinding?.elementId
        ? idMap.get(el.startBinding.elementId) ?? el.startBinding.elementId
        : null;
      const endId = el.endBinding?.elementId
        ? idMap.get(el.endBinding.elementId) ?? el.endBinding.elementId
        : null;
      out.push({
        ...base,
        points,
        lastCommittedPoint: null,
        startBinding: startId ? { elementId: startId, focus: 0, gap: 4 } : null,
        endBinding: endId ? { elementId: endId, focus: 0, gap: 4 } : null,
        startArrowhead: null,
        endArrowhead: type === "arrow" ? "arrow" : null,
        elbowed: false,
      });
      continue;
    }

    out.push(base);

    // synthesize label text if shape has a label
    if (el.label?.text) {
      const labelId = rid();
      const w = Number(base.width);
      const h = Number(base.height);
      out.push({
        id: labelId,
        type: "text",
        x: Number(base.x) + w / 2 - 40,
        y: Number(base.y) + h / 2 - 10,
        width: 80,
        height: 20,
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
        text: String(el.label.text),
        fontSize: 18,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        baseline: 18,
        containerId: base.id,
        originalText: String(el.label.text),
        autoResize: true,
        lineHeight: 1.25,
      });
      // bind label to container
      (base.boundElements as { id: string; type: string }[]).push({ id: labelId, type: "text" });
    }
  }

  return out;
}

const SCENE_TOOL = {
  type: "function" as const,
  function: {
    name: "set_scene",
    description: "Replace the canvas with these elements. Coordinates are in pixels.",
    parameters: {
      type: "object",
      properties: {
        elements: {
          type: "array",
          description:
            "Excalidraw-style elements. Use shapes (rectangle/ellipse/diamond) with a label.text field for boxes, text for free labels, and arrow with startBinding/endBinding {elementId} to connect shapes by id.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["rectangle", "ellipse", "diamond", "text", "arrow", "line"] },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              text: { type: "string" },
              backgroundColor: { type: "string" },
              strokeColor: { type: "string" },
              label: {
                type: "object",
                properties: { text: { type: "string" } },
              },
              startBinding: {
                type: "object",
                properties: { elementId: { type: "string" } },
              },
              endBinding: {
                type: "object",
                properties: { elementId: { type: "string" } },
              },
            },
            required: ["type"],
          },
        },
      },
      required: ["elements"],
    },
  },
};

async function callAiForScene(
  apiKey: string,
  system: string,
  user: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/zenifold/aurora-os",
      "X-Title": "Aurora Canvas",
    },
    body: JSON.stringify({
      model: "xiaomi/mimo-v2-flash",
      temperature: 0.3,
      max_tokens: 4000,
      tools: [SCENE_TOOL],
      tool_choice: { type: "function", function: { name: "set_scene" } },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}";
  let parsed: { elements?: unknown[] } = {};
  try {
    parsed = JSON.parse(args);
  } catch {
    parsed = {};
  }
  return normalizeElements(parsed.elements ?? []);
}

const SYSTEM_PROMPT =
  "You design clean, editable Excalidraw diagrams. Use rectangle/ellipse/diamond with label.text for nodes, and arrow with startBinding.elementId/endBinding.elementId to connect them. Lay shapes out cleanly: 200px wide × 80px tall boxes, 60-100px gaps, top-down or left-right flow. Coordinates start at 0,0. Stable ids like 'n1','n2' help arrows reference shapes. Return ONLY via the set_scene tool.";

/**
 * Server-only helper: generate Excalidraw elements from a natural-language prompt.
 * Used by the agent loop's `create_canvas` tool. Not a server function — safe
 * to import from other server-only files (`.functions.ts` / `.server.ts`).
 */
export async function aiGenerateCanvasElements(
  apiKey: string,
  prompt: string,
): Promise<Record<string, unknown>[]> {
  return callAiForScene(apiKey, SYSTEM_PROMPT, `Draft a diagram for: ${prompt}`);
}

/* -------------------------------- generate -------------------------------- */

export const generateCanvas = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ page_id: z.string().uuid(), prompt: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Not authenticated" } as const;

    const { data: page } = await supabaseAdmin
      .from("pages")
      .select("id, workspace_id, content")
      .eq("id", data.page_id)
      .maybeSingle();
    if (!page) return { error: "Page not found" } as const;

    const apiKey = await getApiKey(page.workspace_id);
    if (!apiKey) return { error: "No OpenRouter API key configured. Add one in Settings → AI." } as const;

    try {
      const elements = await callAiForScene(apiKey, SYSTEM_PROMPT, `Draft a diagram for: ${data.prompt}`);
      const scene = { type: "excalidraw", elements, appState: {}, files: {} };
      await supabaseAdmin
        .from("pages")
        .update({ content: scene as never, updated_by: userId } as never)
        .eq("id", data.page_id);
      return { ok: true, elements: elements as object[] } as const;
    } catch (e) {
      return { error: (e as Error).message } as const;
    }
  });

/* --------------------------------- improve -------------------------------- */

export const improveCanvas = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        page_id: z.string().uuid(),
        instruction: z.string().min(1).max(2000),
        elements: z.array(z.unknown()).max(500),
        selected_ids: z.array(z.string()).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await authedUserId();
    if (!userId) return { error: "Not authenticated" } as const;

    const { data: page } = await supabaseAdmin
      .from("pages")
      .select("id, workspace_id")
      .eq("id", data.page_id)
      .maybeSingle();
    if (!page) return { error: "Page not found" } as const;

    const apiKey = await getApiKey(page.workspace_id);
    if (!apiKey) return { error: "No OpenRouter API key configured. Add one in Settings → AI." } as const;

    const selected = new Set(data.selected_ids ?? []);
    const hasSelection = selected.size > 0;

    // Slim the current scene before sending
    const slim = (data.elements as Record<string, unknown>[])
      .filter((e) => e && typeof e === "object" && !e.isDeleted)
      .slice(0, 200)
      .map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        text: e.text,
        backgroundColor: e.backgroundColor,
        strokeColor: e.strokeColor,
        startBinding: e.startBinding,
        endBinding: e.endBinding,
        containerId: e.containerId,
        selected: hasSelection ? selected.has(String(e.id)) : undefined,
      }));

    const userMsg = [
      `Current canvas (Excalidraw elements):`,
      "```json",
      JSON.stringify(slim).slice(0, 8000),
      "```",
      "",
      hasSelection
        ? `The user selected these elements (selected: true above): ${[...selected].join(", ")}. Focus your edits on these. Leave non-selected elements unchanged where possible — keep their ids, positions, and properties.`
        : "",
      `Instruction: ${data.instruction}`,
      "",
      "Return the COMPLETE new scene via set_scene (replacement, not a diff). Preserve existing ids where elements still apply so positions stay stable.",
    ].filter(Boolean).join("\n");

    try {
      const elements = await callAiForScene(apiKey, SYSTEM_PROMPT, userMsg);
      return { ok: true, elements: elements as object[] } as const;
    } catch (e) {
      return { error: (e as Error).message } as const;
    }
  });

