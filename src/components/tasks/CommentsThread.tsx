import { useMemo, useState } from "react";
import { confirmDialog } from "@/lib/dialogs";
import { useAuth } from "@/lib/auth-context";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
  useToggleReaction,
  useResolveComment,
  type Comment,
} from "@/hooks/use-comments";
import { useTypingIndicator } from "@/hooks/use-presence";
import { MentionInput, MentionText } from "./MentionInput";
import { AttachmentsList } from "@/components/app/AttachmentsList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import {
  Reply,
  Trash2,
  Pencil,
  X,
  Check,
  CheckCircle2,
  RotateCcw,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";

const REACTION_PALETTE = ["👍", "❤️", "🎉", "🚀", "👀", "😂", "🤔", "✅"];

export function CommentsThread({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useComments(taskId);
  const create = useCreateComment(taskId);
  const { typing, broadcastTyping } = useTypingIndicator(`task:${taskId}`);

  const [draft, setDraft] = useState("");
  const [draftMentions, setDraftMentions] = useState<string[]>([]);
  const [showResolved, setShowResolved] = useState(false);

  const tree = useMemo(() => buildTree(comments), [comments]);
  const visibleTree = showResolved ? tree : tree.filter((c) => !c.resolved_at);
  const resolvedCount = tree.length - visibleTree.length;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    create.mutate({
      content: textToDoc(text),
      mentions: draftMentions,
    });
    setDraft("");
    setDraftMentions([]);
  };

  const myName = user?.email?.split("@")[0] ?? "Someone";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <UserAvatar name={myName} url={null} />
          <div className="flex-1">
            <MentionInput
              value={draft}
              onChange={(text, mentions) => {
                setDraft(text);
                setDraftMentions(mentions);
                if (text.trim()) void broadcastTyping(myName);
              }}
              placeholder="Add a comment… use @ to mention"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {typing.length > 0 ? `${typing.join(", ")} typing…` : "\u00A0"}
          </span>
          <Button
            size="sm"
            onClick={submit}
            disabled={!draft.trim() || create.isPending}
          >
            Comment
          </Button>
        </div>
      </div>

      {resolvedCount > 0 && (
        <button
          onClick={() => setShowResolved((s) => !s)}
          className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted/50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {showResolved
            ? `Hide ${resolvedCount} resolved thread${resolvedCount === 1 ? "" : "s"}`
            : `Show ${resolvedCount} resolved thread${resolvedCount === 1 ? "" : "s"}`}
        </button>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : visibleTree.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-4">
          {visibleTree.map((c) => (
            <CommentItem key={c.id} comment={c} taskId={taskId} depth={0} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface TreeComment extends Comment {
  children: TreeComment[];
}

function buildTree(rows: Comment[]): TreeComment[] {
  const map = new Map<string, TreeComment>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: TreeComment[] = [];
  map.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) map.get(c.parent_id)!.children.push(c);
    else roots.push(c);
  });
  return roots;
}

function CommentItem({
  comment,
  taskId,
  depth,
}: {
  comment: TreeComment;
  taskId: string;
  depth: number;
}) {
  const { user } = useAuth();
  const update = useUpdateComment(taskId);
  const remove = useDeleteComment(taskId);
  const create = useCreateComment(taskId);
  const toggleReaction = useToggleReaction(taskId);
  const resolve = useResolveComment(taskId);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(docToText(comment.content));
  const [editMentions, setEditMentions] = useState<string[]>(comment.mentions ?? []);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyMentions, setReplyMentions] = useState<string[]>([]);

  const isMine = user?.id === comment.author_id;
  const isResolved = !!comment.resolved_at;
  const isRoot = depth === 0;
  const name = comment.author?.display_name ?? "Unknown";
  const text = docToText(comment.content);

  return (
    <li className={cn(isResolved && "opacity-60")}>
      <div className="flex items-start gap-2">
        <UserAvatar name={name} url={comment.author?.avatar_url ?? null} />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              {comment.updated_at !== comment.created_at && " · edited"}
            </span>
            {isResolved && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-2.5 w-2.5" /> Resolved
              </span>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <MentionInput
                value={editText}
                onChange={(t, m) => {
                  setEditText(t);
                  setEditMentions(m);
                }}
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    update.mutate({ id: comment.id, content: textToDoc(editText) });
                    setEditing(false);
                  }}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditText(text);
                    setEditMentions(comment.mentions ?? []);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed">
              <MentionText text={text || "(empty)"} />
            </div>
          )}

          {/* Reactions */}
          {Object.keys(comment.reactions ?? {}).length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {Object.entries(comment.reactions).map(([emoji, userIds]) => {
                const mine = user && userIds.includes(user.id);
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction.mutate({ comment, emoji })}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                      mine
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-muted/40 hover:bg-muted",
                    )}
                  >
                    <span>{emoji}</span>
                    <span className="font-medium tabular-nums">{userIds.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted">
                  <Smile className="h-3 w-3" /> React
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-1">
                <div className="flex gap-0.5">
                  {REACTION_PALETTE.map((e) => (
                    <button
                      key={e}
                      onClick={() => toggleReaction.mutate({ comment, emoji: e })}
                      className="rounded p-1.5 text-base transition hover:bg-accent"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {depth < 3 && !isResolved && (
              <button
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                onClick={() => setReplying((r) => !r)}
              >
                {replying ? <X className="h-3 w-3" /> : <Reply className="h-3 w-3" />}{" "}
                {replying ? "Cancel" : "Reply"}
              </button>
            )}
            {isRoot && (
              <button
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                onClick={() => resolve.mutate({ id: comment.id, resolved: !isResolved })}
              >
                {isResolved ? (
                  <>
                    <RotateCcw className="h-3 w-3" /> Reopen
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Resolve
                  </>
                )}
              </button>
            )}
            {isMine && !editing && (
              <>
                <button
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: "Delete this comment?",
                      confirmLabel: "Delete",
                      tone: "destructive",
                    });
                    if (ok) remove.mutate(comment.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </>
            )}
          </div>

          {replying && (
            <div className="space-y-2 pt-1">
              <MentionInput
                value={replyText}
                onChange={(t, m) => {
                  setReplyText(t);
                  setReplyMentions(m);
                }}
                placeholder="Reply…"
                rows={2}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (!replyText.trim()) return;
                    create.mutate({
                      content: textToDoc(replyText),
                      parent_id: comment.id,
                      mentions: replyMentions,
                    });
                    setReplyText("");
                    setReplyMentions([]);
                    setReplying(false);
                  }}
                >
                  Reply
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ml-8 mt-2">
        <AttachmentsList entityType="comment" entityId={comment.id} compact />
      </div>

      {comment.children.length > 0 && (
        <ul className="ml-8 mt-3 space-y-3 border-l border-border pl-3">
          {comment.children.map((child) => (
            <CommentItem key={child.id} comment={child} taskId={taskId} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function UserAvatar({ name, url }: { name: string; url: string | null }) {
  return (
    <Avatar className="h-7 w-7">
      {url && <AvatarImage src={url} alt={name} />}
      <AvatarFallback className="text-xs">{name.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

// Plain-text <-> TipTap doc shape — keeps backwards compatibility with old comments
function textToDoc(text: string): unknown {
  return {
    type: "doc",
    content: text
      .split(/\n+/)
      .filter((line) => line.length > 0)
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      })),
  };
}

function docToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return "";
  const doc = content as { content?: Array<{ content?: Array<{ text?: string }> }> };
  if (!doc.content) return "";
  return doc.content
    .map((node) => (node.content ?? []).map((leaf) => leaf.text ?? "").join(""))
    .join("\n");
}
