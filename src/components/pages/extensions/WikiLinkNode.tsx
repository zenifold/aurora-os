import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useQuery } from "@tanstack/react-query";
import { FileText, FileQuestion } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikilink: {
      insertWikiLink: (attrs: { pageId: string; title: string; icon?: string | null }) => ReturnType;
    };
  }
}

function WikiLinkView({ node, selected }: NodeViewProps) {
  const ws = useWorkspaceStore((s) => s.current);
  const { pageId, title: cachedTitle, icon: cachedIcon } = node.attrs as {
    pageId: string;
    title: string;
    icon: string | null;
  };

  const { data, isLoading } = useQuery({
    queryKey: ["wiki-page", pageId, ws?.id ?? ""],
    enabled: !!pageId && !!ws,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("pages")
        .select("id,title,icon,scope,scope_id,is_archived")
        .eq("id", pageId)
        .maybeSingle();
      return data;
    },
  });

  const exists = !!data;
  const title = data?.title ?? cachedTitle ?? "Untitled";
  const icon = data?.icon ?? cachedIcon ?? null;

  const inner = (
    <span
      className={`mx-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0 align-baseline text-[0.95em] leading-tight no-underline ${
        exists
          ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      } ${selected ? "ring-2 ring-primary/40" : ""}`}
      title={exists ? `Page: ${title}` : "Page not found (may have been deleted)"}
    >
      {exists ? icon ? <span className="text-[0.9em]">{icon}</span> : <FileText className="h-3 w-3" /> : <FileQuestion className="h-3 w-3" />}
      <span className="font-medium">{isLoading ? "…" : title}</span>
    </span>
  );

  return (
    <NodeViewWrapper as="span" contentEditable={false} data-type="wikilink" data-page-id={pageId}>
      {exists ? (
        <Link to="/app/pages" search={{ p: pageId } as never} className="no-underline">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </NodeViewWrapper>
  );
}

export const WikiLinkNode = Node.create({
  name: "wikilink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      pageId: { default: "" },
      title: { default: "" },
      icon: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-type='wikilink']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "wikilink" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView);
  },
  addCommands() {
    return {
      insertWikiLink:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
