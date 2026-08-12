import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Clock, FileText, Hash } from "lucide-react";
import type { Page } from "@/lib/page-types";

interface Props {
  page: Page;
}

export function PageMetaFooter({ page }: Props) {
  const { words, chars, minutes } = useMemo(() => {
    const text = page.content_text ?? "";
    const w = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words: w, chars: text.length, minutes: Math.max(1, Math.round(w / 220)) };
  }, [page.content_text]);

  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" />
        {words.toLocaleString()} word{words === 1 ? "" : "s"}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Hash className="h-3.5 w-3.5" />
        {chars.toLocaleString()} character{chars === 1 ? "" : "s"}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        {minutes} min read
      </span>
      <span className="ml-auto">
        Updated {formatDistanceToNow(new Date(page.updated_at), { addSuffix: true })}
      </span>
    </div>
  );
}
