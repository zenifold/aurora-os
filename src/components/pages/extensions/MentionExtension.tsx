import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

export interface MentionItem {
  id: string;
  label: string;
  sub?: string;
  icon?: string;
  kind: "user" | "task" | "page";
}

interface ListProps {
  items: MentionItem[];
  command: (item: { id: string; label: string; kind: string }) => void;
}

export interface ListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<ListRef, ListProps>((props, ref) => {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [props.items]);

  const select = (i: number) => {
    const item = props.items[i];
    if (item) props.command({ id: item.id, label: item.label, kind: item.kind });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        setIndex((i) => (i + 1) % Math.max(1, props.items.length));
        return true;
      }
      if (event.key === "ArrowUp") {
        setIndex((i) => (i - 1 + props.items.length) % Math.max(1, props.items.length));
        return true;
      }
      if (event.key === "Enter") {
        select(index);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="rounded-md border border-border bg-popover p-2 text-xs text-muted-foreground shadow-md">
        No matches
      </div>
    );
  }
  return (
    <div className="max-h-72 w-64 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
      {props.items.map((item, i) => (
        <button
          key={`${item.kind}-${item.id}`}
          onMouseDown={(e) => {
            e.preventDefault();
            select(i);
          }}
          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
            i === index ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          <span className="text-base">{item.icon ?? (item.kind === "user" ? "👤" : item.kind === "task" ? "✅" : "📄")}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{item.label}</div>
            {item.sub && <div className="truncate text-xs text-muted-foreground">{item.sub}</div>}
          </div>
          <span className="text-[10px] uppercase text-muted-foreground">{item.kind}</span>
        </button>
      ))}
    </div>
  );
});
MentionList.displayName = "MentionList";

export function makeMentionExtension(getItems: (query: string) => Promise<MentionItem[]>) {
  return Mention.extend({
    addAttributes() {
      return {
        id: { default: null },
        label: { default: null },
        kind: { default: "user" },
      };
    },
    renderHTML({ node, HTMLAttributes }) {
      return [
        "span",
        {
          ...HTMLAttributes,
          class: "rounded bg-primary/10 px-1 py-0.5 text-primary font-medium",
          "data-mention-kind": node.attrs.kind,
          "data-mention-id": node.attrs.id,
        },
        `@${node.attrs.label ?? node.attrs.id}`,
      ];
    },
  }).configure({
    HTMLAttributes: { class: "mention" },
    suggestion: {
      char: "@",
      items: async ({ query }) => getItems(query),
      render: () => {
        let component: ReactRenderer<ListRef, ListProps> | null = null;
        let popup: TippyInstance[] | null = null;

        return {
          onStart: (props) => {
            component = new ReactRenderer(MentionList, {
              props: props as unknown as ListProps,
              editor: props.editor,
            });
            const rect = props.clientRect?.();
            if (!rect) return;
            popup = tippy("body", {
              getReferenceClientRect: () => rect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "bottom-start",
            });
          },
          onUpdate(props) {
            component?.updateProps(props as unknown as ListProps);
            const rect = props.clientRect?.();
            if (rect) popup?.[0]?.setProps({ getReferenceClientRect: () => rect });
          },
          onKeyDown(props) {
            if (props.event.key === "Escape") {
              popup?.[0]?.hide();
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit() {
            popup?.[0]?.destroy();
            component?.destroy();
          },
        };
      },
    },
  });
}
