import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ExternalLink, FileText, ListChecks, Video } from "lucide-react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      insertEmbed: (attrs: { kind: "task" | "page" | "url"; refId?: string; url?: string; label?: string }) => ReturnType;
    };
  }
}

function EmbedView({ node }: NodeViewProps) {
  const { kind, refId, url, label } = node.attrs as {
    kind: "task" | "page" | "url";
    refId?: string;
    url?: string;
    label?: string;
  };

  if (kind === "task" && refId) {
    return (
      <NodeViewWrapper as="div" className="my-2">
        <a
          href={`#task-${refId}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm hover:bg-muted"
          contentEditable={false}
        >
          <ListChecks className="h-4 w-4 text-primary" />
          <span className="font-medium">{label ?? "Task"}</span>
        </a>
      </NodeViewWrapper>
    );
  }
  if (kind === "page" && refId) {
    return (
      <NodeViewWrapper as="div" className="my-2">
        <a
          href={`#page-${refId}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm hover:bg-muted"
          contentEditable={false}
        >
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-medium">{label ?? "Page"}</span>
        </a>
      </NodeViewWrapper>
    );
  }
  if (kind === "url" && url) {
    const isVideo = /(youtube\.com|youtu\.be|vimeo\.com|loom\.com)/i.test(url);
    if (isVideo) {
      let embedUrl = url;
      const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      if (yt) embedUrl = `https://www.youtube.com/embed/${yt[1]}`;
      const loom = url.match(/loom\.com\/share\/([\w-]+)/);
      if (loom) embedUrl = `https://www.loom.com/embed/${loom[1]}`;
      const vim = url.match(/vimeo\.com\/(\d+)/);
      if (vim) embedUrl = `https://player.vimeo.com/video/${vim[1]}`;
      return (
        <NodeViewWrapper as="div" className="my-3" contentEditable={false}>
          <div className="aspect-video w-full overflow-hidden rounded-md border border-border">
            <iframe src={embedUrl} className="h-full w-full" title={label ?? "Embed"} allowFullScreen />
          </div>
        </NodeViewWrapper>
      );
    }
    return (
      <NodeViewWrapper as="div" className="my-2" contentEditable={false}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm hover:bg-muted"
        >
          {isVideo ? <Video className="h-4 w-4 text-primary" /> : <ExternalLink className="h-4 w-4 text-primary" />}
          <span className="truncate">{label ?? url}</span>
        </a>
      </NodeViewWrapper>
    );
  }
  return null;
}

export const EmbedNode = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      kind: { default: "url" },
      refId: { default: null },
      url: { default: null },
      label: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-type='embed']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "embed" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },
  addCommands() {
    return {
      insertEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
