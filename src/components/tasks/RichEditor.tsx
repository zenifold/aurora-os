import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { promptDialog } from "@/lib/dialogs";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Code, Quote, Link as LinkIcon, Strikethrough } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichEditorProps {
  content: unknown;
  onChange?: (json: unknown) => void;
  onBlur?: (json: unknown) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  compact?: boolean;
}

export function RichEditor({ content, onChange, onBlur, placeholder, editable = true, className, compact }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-primary underline" } }),
    ],
    content: normalize(content),
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          compact ? "min-h-[2.5rem]" : "min-h-32",
          "prose-p:my-1 prose-headings:mb-2 prose-headings:mt-3 prose-ul:my-1 prose-ol:my-1",
        ),
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
    onBlur: ({ editor }) => onBlur?.(editor.getJSON()),
  });

  // Sync external content changes (e.g., switching tasks)
  useEffect(() => {
    if (!editor) return;
    const next = normalize(content);
    const current = editor.getJSON();
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, JSON.stringify(content)]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border border-border bg-background", className)}>
      {editable && !compact && <Toolbar editor={editor} />}
      <div className={cn("px-3", compact ? "py-2" : "py-2")}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const Btn = ({ active, onClick, children, label }: { active?: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
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

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
      <Btn label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></Btn>
      <Btn label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></Btn>
      <Btn label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></Btn>
      <Btn label="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></Btn>
      <Btn label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></Btn>
      <Btn label="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-3.5 w-3.5" /></Btn>
      <Btn
        label="Link"
        active={editor.isActive("link")}
        onClick={async () => {
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
        }}
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </Btn>
    </div>
  );
}

function normalize(content: unknown): object {
  if (!content) return { type: "doc", content: [{ type: "paragraph" }] };
  if (typeof content === "object" && content !== null && "type" in content) return content as object;
  // Legacy { text: "…" } shape from Phase 1
  if (typeof content === "object" && content !== null && "text" in content) {
    const text = String((content as { text?: string }).text ?? "");
    if (!text) return { type: "doc", content: [{ type: "paragraph" }] };
    return {
      type: "doc",
      content: text.split(/\n{2,}/).map((para) => ({
        type: "paragraph",
        content: para ? [{ type: "text", text: para }] : [],
      })),
    };
  }
  return { type: "doc", content: [{ type: "paragraph" }] };
}
