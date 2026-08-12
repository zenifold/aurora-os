import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface Props {
  /** Tiptap document JSON. */
  content: unknown;
  /** A scrollable element ancestor used to scroll headings into view. */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function extractHeadings(doc: unknown): Heading[] {
  if (!doc || typeof doc !== "object") return [];
  const out: Heading[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; attrs?: { level?: number }; content?: unknown[] };
    if (n.type === "heading" && (n.attrs?.level ?? 1) <= 3) {
      const text: string[] = [];
      const collect = (c: unknown) => {
        if (!c || typeof c !== "object") return;
        const cn = c as { text?: string; content?: unknown[] };
        if (typeof cn.text === "string") text.push(cn.text);
        if (Array.isArray(cn.content)) cn.content.forEach(collect);
      };
      (n.content ?? []).forEach(collect);
      const t = text.join("").trim();
      if (t) out.push({ id: slugify(t), text: t, level: n.attrs?.level ?? 1 });
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return out;
}

export function PageTocRail({ content, scrollContainerRef }: Props) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  const [active, setActive] = useState<string | null>(null);

  // Decorate matching headings in the editor with an id attribute on mount/update.
  useEffect(() => {
    const root = scrollContainerRef?.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLHeadingElement>("h1, h2, h3");
    const used = new Set<string>();
    nodes.forEach((el) => {
      const t = (el.textContent || "").trim();
      if (!t) return;
      let id = slugify(t);
      let i = 1;
      while (used.has(id)) {
        id = `${slugify(t)}-${i++}`;
      }
      used.add(id);
      el.setAttribute("id", id);
    });

    const onScroll = () => {
      let current: string | null = null;
      nodes.forEach((el) => {
        const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
        if (top < 120) current = el.id || current;
      });
      setActive(current);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [content, scrollContainerRef]);

  if (headings.length < 2) return null;

  return (
    <aside className="hidden h-full w-56 shrink-0 overflow-auto border-l border-border/60 px-3 py-6 xl:block">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </div>
      <ul className="space-y-0.5 text-sm">
        {headings.map((h, i) => (
          <li key={`${h.id}-${i}`}>
            <button
              onClick={() => {
                const root = scrollContainerRef?.current;
                const el = root?.querySelector<HTMLElement>(`#${CSS.escape(h.id)}`);
                if (el && root) {
                  root.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
                }
              }}
              className={cn(
                "block w-full truncate rounded px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                h.level === 2 && "pl-4",
                h.level === 3 && "pl-6 text-xs",
                active === h.id && "bg-muted font-medium text-foreground",
              )}
              title={h.text}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
