import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useMemo } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListChecks, Strikethrough } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteType } from "@/lib/types";

interface NoteEditorProps {
  content: unknown;
  noteType: NoteType;
  onChange?: (json: unknown) => void;
  onBlur?: (json: unknown) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  showToolbar?: boolean;
}

export function NoteEditor({
  content,
  noteType,
  onChange,
  onBlur,
  placeholder,
  editable = true,
  className,
  showToolbar = true,
}: NoteEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: placeholder ?? "Take a note…" }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-primary underline" } }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: normalize(content, noteType),
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none min-h-[80px]",
          "prose-p:my-1 prose-headings:mb-2 prose-headings:mt-3 prose-ul:my-1 prose-ol:my-1",
          // Task list styling
          "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:p-0",
          "[&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2 [&_ul[data-type=taskList]_li]:items-start",
          "[&_ul[data-type=taskList]_li>label]:flex-shrink-0 [&_ul[data-type=taskList]_li>label]:mt-1",
          "[&_ul[data-type=taskList]_li>div]:flex-1",
          "[&_ul[data-type=taskList]_input[type=checkbox]]:w-4 [&_ul[data-type=taskList]_input[type=checkbox]]:h-4",
          "[&_ul[data-type=taskList]_li[data-checked=true]>div]:line-through [&_ul[data-type=taskList]_li[data-checked=true]>div]:opacity-60",
        ),
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
    onBlur: ({ editor }) => onBlur?.(editor.getJSON()),
  });

  // Sync external content changes
  useEffect(() => {
    if (!editor) return;
    const next = normalize(content, noteType);
    const current = editor.getJSON();
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, JSON.stringify(content), noteType]);

  if (!editor) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {editable && showToolbar && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const Btn = ({
    active,
    onClick,
    children,
    label,
  }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    label: string;
  }) => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 text-slate-600 transition hover:bg-slate-200/60 hover:text-slate-900",
        active && "bg-slate-200/80 text-slate-900",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <Btn label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        label="Check list"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL", prev ?? "https://");
          if (url === null) return;
          if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
          else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </Btn>
    </div>
  );
}

function normalize(content: unknown, noteType: NoteType): object {
  const empty =
    noteType === "check_list"
      ? {
          type: "doc",
          content: [
            {
              type: "taskList",
              content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] }],
            },
          ],
        }
      : noteType === "bullet_list"
      ? { type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] }] }
      : { type: "doc", content: [{ type: "paragraph" }] };
  if (!content) return empty;
  if (typeof content === "object" && content !== null && "type" in content) return content as object;
  return empty;
}

/** Count checklist progress from doc JSON. Returns null for non-checklist docs. */
export function checklistProgress(doc: unknown): { done: number; total: number } | null {
  if (!doc || typeof doc !== "object") return null;
  let done = 0;
  let total = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; attrs?: { checked?: boolean }; content?: unknown[] };
    if (n.type === "taskItem") {
      total++;
      if (n.attrs?.checked) done++;
    }
    if (Array.isArray(n.content)) for (const c of n.content) walk(c);
  };
  walk(doc);
  return total === 0 ? null : { done, total };
}

/** Extract plain text preview from doc JSON. */
export function docPreview(doc: unknown, maxChars = 220): string {
  if (!doc || typeof doc !== "object") return "";
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && n.text) out.push(n.text);
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
      if (n.type === "paragraph" || n.type === "listItem" || n.type === "taskItem") out.push("\n");
    }
  };
  walk(doc);
  const txt = out.join("").trim();
  return txt.length > maxChars ? txt.slice(0, maxChars) + "…" : txt;
}
