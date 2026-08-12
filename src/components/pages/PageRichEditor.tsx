import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { promptDialog } from "@/lib/dialogs";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import "tippy.js/dist/tippy.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Quote,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  Sparkles,
  Loader2,
  Wand2,
  ListChecks,
  ScrollText,
  Minus,
  Video,
  AtSign,
  Database,
  Link2,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmbedNode } from "./extensions/EmbedNode";
import { BindingNode } from "./extensions/BindingNode";
import { WikiLinkNode } from "./extensions/WikiLinkNode";
import { BlockAttributes } from "./extensions/BlockAttributes";
import { BindingPickerDialog } from "./BindingPickerDialog";
import { WikiLinkPickerDialog } from "./WikiLinkPickerDialog";
import { makeMentionExtension, type MentionItem } from "./extensions/MentionExtension";

import { useWorkspaceMembers } from "@/hooks/use-comments";
import { usePages } from "@/hooks/use-pages";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface Props {
  content: unknown;
  onChange?: (json: unknown) => void;
  onAiAction?: (action: "improve" | "summarize" | "continue" | "to_tasks", selection: string) => Promise<void> | void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  /** Preselect this project in the live-data picker (e.g. when editing a project page). */
  defaultProjectId?: string | null;
  /** Default scope when creating a new page from the wiki-link picker. */
  pageScope?: "workspace" | "project";
  pageScopeId?: string | null;
}

const SLASH_ITEMS = [
  { id: "h1", label: "Heading 1", icon: <Heading1 className="h-4 w-4" />, run: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: "h2", label: "Heading 2", icon: <Heading2 className="h-4 w-4" />, run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: "h3", label: "Heading 3", icon: <Heading3 className="h-4 w-4" />, run: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: "ul", label: "Bullet list", icon: <List className="h-4 w-4" />, run: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { id: "ol", label: "Ordered list", icon: <ListOrdered className="h-4 w-4" />, run: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { id: "task", label: "Task list", icon: <CheckSquare className="h-4 w-4" />, run: (e: Editor) => e.chain().focus().toggleList("taskList", "taskItem").run() },
  { id: "quote", label: "Quote", icon: <Quote className="h-4 w-4" />, run: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
  { id: "code", label: "Code block", icon: <Code className="h-4 w-4" />, run: (e: Editor) => e.chain().focus().toggleCodeBlock().run() },
  { id: "hr", label: "Divider", icon: <Minus className="h-4 w-4" />, run: (e: Editor) => e.chain().focus().setHorizontalRule().run() },
  {
    id: "embed",
    label: "Embed link / video",
    icon: <Video className="h-4 w-4" />,
    run: async (e: Editor) => {
      const url = await promptDialog({
        title: "Embed a link or video",
        description: "Paste a URL from YouTube, Loom, Vimeo, or any other site.",
        placeholder: "https://...",
        confirmLabel: "Embed",
        required: true,
      });
      if (!url) return;
      e.chain().focus().insertEmbed({ kind: "url", url, label: url }).run();
    },
  },
  {
    id: "mention",
    label: "Mention person / task / page",
    icon: <AtSign className="h-4 w-4" />,
    run: (e: Editor) => {
      e.chain().focus().insertContent("@").run();
    },
  },
];


export function PageRichEditor({ content, onChange, onAiAction, placeholder, editable = true, className, defaultProjectId, pageScope = "workspace", pageScopeId = null }: Props) {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: members = [] } = useWorkspaceMembers();
  const { data: pages = [] } = usePages({});

  const [bindingOpen, setBindingOpen] = useState(false);
  const [wikiOpen, setWikiOpen] = useState(false);

  const slashItems = useMemo(
    () => [
      ...SLASH_ITEMS,
      {
        id: "binding",
        label: "Live data ({{ }})",
        icon: <Database className="h-4 w-4" />,
        run: (_e: Editor) => setBindingOpen(true),
      },
      {
        id: "wikilink",
        label: "Link to page ([[ ]])",
        icon: <Link2 className="h-4 w-4" />,
        run: (_e: Editor) => setWikiOpen(true),
      },
    ],
    [],
  );

  const mentionExt = useMemo(() => {
    return makeMentionExtension(async (query: string) => {
      const q = query.toLowerCase();
      const memberItems: MentionItem[] = members
        .filter((m) => (m.display_name ?? "").toLowerCase().includes(q))
        .slice(0, 5)
        .map((m) => ({ id: m.id, label: m.display_name ?? "User", kind: "user" as const, icon: "👤" }));

      const pageItems: MentionItem[] = pages
        .filter((p) => p.title.toLowerCase().includes(q))
        .slice(0, 5)
        .map((p) => ({ id: p.id, label: p.title, kind: "page" as const, icon: p.icon ?? "📄" }));

      let taskItems: MentionItem[] = [];
      if (ws && q.length > 0) {
        const { data } = await supabase
          .from("tasks")
          .select("id,title")
          .eq("workspace_id", ws.id)
          .ilike("title", `%${query}%`)
          .limit(5);
        taskItems = (data ?? []).map((t) => ({ id: t.id, label: t.title, kind: "task" as const, icon: "✅" }));
      }
      return [...memberItems, ...pageItems, ...taskItems];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length, pages.length, ws?.id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: placeholder ?? "Type / for commands…" }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-primary underline" } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      EmbedNode,
      BindingNode,
      WikiLinkNode,
      BlockAttributes,
      mentionExt,
    ],
    content: normalize(content),
    editable,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60vh] prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2",
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
  });

  const [slash, setSlash] = useState<{ open: boolean; query: string; index: number }>({ open: false, query: "", index: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [aiBusy, setAiBusy] = useState(false);

  // Sync external content
  useEffect(() => {
    if (!editor) return;
    const next = normalize(content);
    const cur = editor.getJSON();
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, JSON.stringify(content)]);

  // Slash command listener
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const { from } = editor.state.selection;
      const $from = editor.state.doc.resolve(from);
      const lineStart = $from.start();
      const textBefore = editor.state.doc.textBetween(lineStart, from, "\n", " ");
      const m = /(?:^|\s)\/(\w*)$/.exec(textBefore);
      if (m) {
        setSlash({ open: true, query: m[1] ?? "", index: 0 });
      } else {
        setSlash((s) => (s.open ? { ...s, open: false } : s));
      }
    };
    editor.on("selectionUpdate", handler);
    editor.on("update", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("update", handler);
    };
  }, [editor]);

  if (!editor) return null;

  const filtered = slashItems.filter((s) => s.label.toLowerCase().includes(slash.query.toLowerCase()));

  const runSlash = (item: (typeof slashItems)[number]) => {
    // remove the trailing /query from the document
    const { from } = editor.state.selection;
    const $from = editor.state.doc.resolve(from);
    const lineStart = $from.start();
    const textBefore = editor.state.doc.textBetween(lineStart, from, "\n", " ");
    const m = /\/(\w*)$/.exec(textBefore);
    if (m) {
      editor.chain().focus().deleteRange({ from: from - (m[0].length), to: from }).run();
    }
    item.run(editor);
    setSlash({ open: false, query: "", index: 0 });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!slash.open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSlash((s) => ({ ...s, index: (s.index + 1) % filtered.length }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSlash((s) => ({ ...s, index: (s.index - 1 + filtered.length) % filtered.length }));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runSlash(filtered[slash.index]);
    } else if (e.key === "Escape") {
      setSlash({ open: false, query: "", index: 0 });
    }
  };

  const getSelectedText = () => {
    const { from, to } = editor.state.selection;
    if (from === to) {
      // fallback to whole doc
      return editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n", " ").slice(0, 8000);
    }
    return editor.state.doc.textBetween(from, to, "\n", " ");
  };

  const callAi = async (action: "improve" | "summarize" | "continue" | "to_tasks") => {
    if (!onAiAction) return;
    const sel = getSelectedText();
    if (!sel.trim()) return;
    setAiBusy(true);
    try {
      await onAiAction(action, sel);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div ref={wrapperRef} className={cn("relative rounded-md", className)}>
      {editable && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-background/95 px-2 py-1 backdrop-blur">
          <Btn label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></Btn>
          <Btn label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></Btn>
          <span className="mx-1 h-4 w-px bg-border" />
          <Btn label="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-3.5 w-3.5" /></Btn>
          <Btn label="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></Btn>
          <Btn label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></Btn>
          <Btn label="Ordered" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></Btn>
          <Btn label="Task list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleList("taskList", "taskItem").run()}><CheckSquare className="h-3.5 w-3.5" /></Btn>
          <Btn label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></Btn>
          <Btn label="Code" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code className="h-3.5 w-3.5" /></Btn>
          <Btn label="Link" active={editor.isActive("link")} onClick={async () => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = await promptDialog({
              title: prev ? "Edit link" : "Add link",
              description: "Leave empty to remove the link.",
              defaultValue: prev ?? "https://",
              placeholder: "https://example.com",
              confirmLabel: "Save link",
            });
            if (url === null) return;
            if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
            else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}><LinkIcon className="h-3.5 w-3.5" /></Btn>
          <Btn
            label="Mark block internal (hide from client portal)"
            onClick={() => (editor.chain().focus() as unknown as { toggleInternalBlock: () => { run: () => boolean } }).toggleInternalBlock().run()}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </Btn>
          <span className="ml-auto" />
          {onAiAction && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={aiBusy}>
                  {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
                  AI
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">AI on selection (or full doc)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => callAi("improve")}>
                  <Wand2 className="mr-2 h-4 w-4" /> Improve writing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => callAi("summarize")}>
                  <ScrollText className="mr-2 h-4 w-4" /> Summarize
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => callAi("continue")}>
                  <Sparkles className="mr-2 h-4 w-4" /> Continue writing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => callAi("to_tasks")}>
                  <ListChecks className="mr-2 h-4 w-4" /> Extract tasks
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="px-4 py-3" onKeyDown={onKeyDown}>
        <EditorContent editor={editor} />
      </div>

      {slash.open && filtered.length > 0 && (
        <div className="absolute left-4 z-20 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-md" style={{ top: "3.2rem" }}>
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Insert</div>
          {filtered.map((item, i) => (
            <button
              key={item.id}
              onMouseDown={(e) => {
                e.preventDefault();
                runSlash(item);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                i === slash.index ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <BindingPickerDialog
        open={bindingOpen}
        onOpenChange={setBindingOpen}
        defaultProjectId={defaultProjectId ?? null}
        onInsert={(attrs) => editor?.chain().focus().insertBinding(attrs).run()}
      />
      <WikiLinkPickerDialog
        open={wikiOpen}
        onOpenChange={setWikiOpen}
        defaultScope={pageScope}
        defaultScopeId={pageScopeId}
        onPick={(p) => editor?.chain().focus().insertWikiLink({ pageId: p.id, title: p.title, icon: p.icon }).run()}
      />
    </div>
  );
}

function Btn({ active, onClick, children, label }: { active?: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function normalize(content: unknown): object {
  if (!content) return { type: "doc", content: [{ type: "paragraph" }] };
  if (typeof content === "object" && content !== null && "type" in content) return content as object;
  return { type: "doc", content: [{ type: "paragraph" }] };
}
