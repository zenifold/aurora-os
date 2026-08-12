/**
 * Markdown → TipTap JSON converter for AI-generated content.
 *
 * Supports:
 *  - headings (# ## ###)
 *  - bullet lists (- *)
 *  - inline marks: **bold**, *italic*, `code`
 *  - markdown links: [label](url)
 *  - entity tokens: [task:UUID] [project:UUID] [page:UUID] [meeting:UUID]
 *    → rendered as inline links with resolvable URLs
 */

type EntityKind = "task" | "project" | "page" | "meeting";

export interface EntityRef {
  kind: EntityKind;
  id: string;
  label: string;
}

export type EntityResolver = (
  kind: EntityKind,
  id: string,
) => { label?: string; href?: string } | string | null;

interface TextNode {
  type: "text";
  text: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

const DEFAULT_PATH: Record<EntityKind, (id: string) => string> = {
  task: (id) => `/app/my-tasks?task=${id}`,
  project: (id) => `/app/p/${id}`,
  page: (id) => `/app/pages?p=${id}`,
  meeting: (id) => `/app/meetings/${id}`,
};

function pushText(out: TextNode[], text: string, marks?: TextNode["marks"]) {
  if (!text) return;
  out.push(marks && marks.length ? { type: "text", text, marks } : { type: "text", text });
}

function linkMark(href: string) {
  const internal = href.startsWith("/");
  return {
    type: "link",
    attrs: internal ? { href } : { href, target: "_blank", rel: "noopener noreferrer" },
  };
}

/**
 * Parse a single line of markdown into TipTap inline nodes.
 * Handles: **bold**, *italic*, `code`, [label](url), and entity tokens.
 */
function parseInline(line: string, resolveLabel?: EntityResolver): TextNode[] {
  const out: TextNode[] = [];
  // Combined regex: order matters — try entity tokens first, then md link, then marks.
  const re =
    /\[(task|project|page|meeting):([0-9a-fA-F-]{8,})\]|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) pushText(out, line.slice(last, m.index));
    if (m[1]) {
      // entity token
      const kind = m[1].toLowerCase() as EntityKind;
      const id = m[2];
      const resolved = resolveLabel ? resolveLabel(kind, id) : null;
      const r =
        typeof resolved === "string" ? { label: resolved, href: undefined } : resolved ?? {};
      const label = r?.label || `${kind} ${id.slice(0, 6)}`;
      const href = r?.href || DEFAULT_PATH[kind](id);
      pushText(out, label, [linkMark(href)]);
    } else if (m[3] && m[4]) {
      // markdown link
      pushText(out, m[3], [linkMark(m[4])]);
    } else if (m[5]) {
      pushText(out, m[5], [{ type: "bold" }]);
    } else if (m[6]) {
      pushText(out, m[6], [{ type: "code" }]);
    } else if (m[7]) {
      pushText(out, m[7], [{ type: "italic" }]);
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) pushText(out, line.slice(last));
  return out;
}

export function mdToTipTap(md: string, resolveLabel?: EntityResolver) {
  const lines = md.split(/\r?\n/);
  const nodes: unknown[] = [];
  let bullets: TextNode[][] | null = null;
  const flush = () => {
    if (bullets && bullets.length) {
      nodes.push({
        type: "bulletList",
        content: bullets.map((b) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: b }],
        })),
      });
    }
    bullets = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      nodes.push({
        type: "heading",
        attrs: { level: h[1].length },
        content: parseInline(h[2], resolveLabel),
      });
      continue;
    }
    const b = /^[-*]\s+(.*)$/.exec(line);
    if (b) {
      bullets = bullets ?? [];
      bullets.push(parseInline(b[1], resolveLabel));
      continue;
    }
    flush();
    nodes.push({ type: "paragraph", content: parseInline(line, resolveLabel) });
  }
  flush();
  if (nodes.length === 0) nodes.push({ type: "paragraph" });
  return { type: "doc", content: nodes };
}
