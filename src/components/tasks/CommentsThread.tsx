import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useComments, useCreateComment, useDeleteComment, useUpdateComment, type Comment } from "@/hooks/use-comments";
import { RichEditor } from "./RichEditor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Reply, Trash2, Pencil, X } from "lucide-react";

export function CommentsThread({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useComments(taskId);
  const create = useCreateComment(taskId);
  const [draft, setDraft] = useState<unknown>(null);
  const [draftKey, setDraftKey] = useState(0);

  const tree = buildTree(comments);

  const submit = () => {
    if (!isEmpty(draft)) {
      create.mutate({ content: draft });
      setDraft(null);
      setDraftKey((k) => k + 1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <UserAvatar name={user?.email ?? "?"} url={null} />
          <div className="flex-1">
            <RichEditor
              key={draftKey}
              content={null}
              placeholder="Add a comment…"
              onChange={setDraft}
              compact
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={isEmpty(draft) || create.isPending}>
            Comment
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tree.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-4">
          {tree.map((c) => (
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

function CommentItem({ comment, taskId, depth }: { comment: TreeComment; taskId: string; depth: number }) {
  const { user } = useAuth();
  const update = useUpdateComment(taskId);
  const remove = useDeleteComment(taskId);
  const create = useCreateComment(taskId);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<unknown>(comment.content);
  const [replying, setReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState<unknown>(null);
  const [replyKey, setReplyKey] = useState(0);

  const isMine = user?.id === comment.author_id;
  const name = comment.author?.display_name ?? "Unknown";

  return (
    <li>
      <div className="flex items-start gap-2">
        <UserAvatar name={name} url={comment.author?.avatar_url ?? null} />
        <div className="flex-1 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              {comment.updated_at !== comment.created_at && " · edited"}
            </span>
          </div>
          {editing ? (
            <div className="space-y-2">
              <RichEditor content={editDraft} onChange={setEditDraft} compact />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { update.mutate({ id: comment.id, content: editDraft }); setEditing(false); }}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditDraft(comment.content); setEditing(false); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-muted/40 px-3 py-2">
              <RichEditor content={comment.content} editable={false} compact className="border-none bg-transparent" />
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {depth < 3 && (
              <button className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => setReplying((r) => !r)}>
                {replying ? <X className="h-3 w-3" /> : <Reply className="h-3 w-3" />} {replying ? "Cancel" : "Reply"}
              </button>
            )}
            {isMine && !editing && (
              <>
                <button className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted" onClick={() => setEditing(true)}>
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-destructive hover:bg-destructive/10" onClick={() => { if (confirm("Delete this comment?")) remove.mutate(comment.id); }}>
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </>
            )}
          </div>

          {replying && (
            <div className="space-y-2 pt-1">
              <RichEditor key={replyKey} content={null} placeholder="Reply…" onChange={setReplyDraft} compact />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => {
                  if (!isEmpty(replyDraft)) {
                    create.mutate({ content: replyDraft, parent_id: comment.id });
                    setReplyDraft(null);
                    setReplyKey((k) => k + 1);
                    setReplying(false);
                  }
                }}>Reply</Button>
              </div>
            </div>
          )}
        </div>
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
  const initial = name.charAt(0).toUpperCase();
  return (
    <Avatar className="h-7 w-7">
      {url && <AvatarImage src={url} alt={name} />}
      <AvatarFallback className="text-xs">{initial}</AvatarFallback>
    </Avatar>
  );
}

function isEmpty(content: unknown): boolean {
  if (!content) return true;
  if (typeof content !== "object") return true;
  const doc = content as { content?: Array<{ content?: unknown[] }> };
  if (!doc.content || doc.content.length === 0) return true;
  return doc.content.every((node) => !node.content || node.content.length === 0);
}
