import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceMembers } from "@/hooks/use-comments";
import { cn } from "@/lib/utils";

export interface MentionToken {
  user_id: string;
  display_name: string;
}

/**
 * Lightweight @mention textarea. Renders a plain textarea but pops a member picker
 * when the user types `@`. Returns the raw text + the list of mentioned user ids.
 */
export function MentionInput({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 2,
  autoFocus,
}: {
  value: string;
  onChange: (text: string, mentions: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  autoFocus?: boolean;
}) {
  const { data: members = [] } = useWorkspaceMembers();
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [picker, setPicker] = useState<{ from: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);

  // Re-extract mention list from text + member roster
  const recomputeMentions = (text: string): string[] => {
    const ids = new Set<string>();
    const re = /@([\w-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const handle = m[1].toLowerCase();
      const member = members.find(
        (mem) => slug(mem.display_name) === handle,
      );
      if (member) ids.add(member.id);
    }
    return Array.from(ids);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart ?? text.length;
    // detect open `@…` token at cursor
    const before = text.slice(0, cursor);
    const match = before.match(/(?:^|\s)@(\w*)$/);
    if (match) {
      setPicker({ from: cursor - match[1].length - 1, query: match[1].toLowerCase() });
      setHighlight(0);
    } else {
      setPicker(null);
    }
    onChange(text, recomputeMentions(text));
  };

  const filtered = picker
    ? members
        .filter((m) =>
          (m.display_name ?? "").toLowerCase().includes(picker.query) ||
          slug(m.display_name).includes(picker.query),
        )
        .slice(0, 6)
    : [];

  const insertMention = (member: { id: string; display_name: string | null }) => {
    if (!picker || !taRef.current) return;
    const handle = slug(member.display_name);
    const ta = taRef.current;
    const before = value.slice(0, picker.from);
    const cursor = ta.selectionStart ?? value.length;
    const after = value.slice(cursor);
    const next = `${before}@${handle} ${after}`;
    onChange(next, recomputeMentions(next));
    setPicker(null);
    requestAnimationFrame(() => {
      const pos = before.length + handle.length + 2;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!picker || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filtered[highlight]);
    } else if (e.key === "Escape") {
      setPicker(null);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        autoFocus={autoFocus}
        className="resize-none"
      />
      {picker && filtered.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {filtered.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition",
                i === highlight ? "bg-accent" : "hover:bg-accent/60",
              )}
            >
              <Avatar className="h-6 w-6">
                {m.avatar_url && <AvatarImage src={m.avatar_url} alt="" />}
                <AvatarFallback className="text-[10px]">
                  {(m.display_name ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{m.display_name ?? "Unnamed"}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                @{slug(m.display_name)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function slug(name: string | null | undefined): string {
  return (name ?? "user").toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "user";
}

/** Render comment text with @mentions highlighted. */
export function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[\w-]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") ? (
          <span key={i} className="rounded bg-primary/15 px-1 font-medium text-primary">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
