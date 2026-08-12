import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Shared markdown renderer for AI chat messages.
 * Properly renders **bold**, *italic*, lists, code, tables, links, etc.
 */
export function ChatMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-p:my-2 prose-p:leading-relaxed",
        "prose-headings:mt-3 prose-headings:mb-2 prose-headings:font-semibold",
        "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-[''] prose-code:after:content-['']",
        "prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-md",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-blockquote:border-l-primary/40 prose-blockquote:text-muted-foreground",
        "prose-hr:border-border",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children as ReactNode}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
