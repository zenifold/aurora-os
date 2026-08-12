import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { usePages } from "@/hooks/use-pages";
import type { Page } from "@/lib/page-types";

interface Props {
  pageId: string;
}

/**
 * Lists every page in the workspace whose Tiptap content references this page
 * (either via a wikilink node or by the page id appearing inside the JSON).
 * Lightweight: scans cached pages client-side — no extra query.
 */
export function BacklinksPanel({ pageId }: Props) {
  const { data: pages = [] } = usePages({});

  const referrers = useMemo(() => {
    const out: Page[] = [];
    for (const p of pages) {
      if (p.id === pageId) continue;
      if (p.is_archived) continue;
      try {
        const text = JSON.stringify(p.content ?? {});
        if (text.includes(pageId)) out.push(p);
      } catch {
        /* ignore */
      }
    }
    return out;
  }, [pages, pageId]);

  if (referrers.length === 0) return null;

  return (
    <div className="mt-10 rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" /> Backlinks · {referrers.length}
      </div>
      <ul className="space-y-1">
        {referrers.map((p) => (
          <li key={p.id}>
            <Link
              to="/app/pages"
              search={{ p: p.id } as never}
              className="inline-flex items-center gap-2 rounded px-1.5 py-0.5 text-sm text-foreground hover:bg-muted"
            >
              <span>{p.icon ?? "📄"}</span>
              <span className="font-medium">{p.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
