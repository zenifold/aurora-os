import { useState } from "react";
import { useSubtasks, useCreateSubtask, useToggleSubtask, useDeleteSubtask } from "@/hooks/use-subtasks";
import type { Task } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SubtasksList({ parent }: { parent: Task }) {
  const { data: subtasks = [], isLoading } = useSubtasks(parent.id);
  const create = useCreateSubtask(parent);
  const toggle = useToggleSubtask(parent.id);
  const remove = useDeleteSubtask(parent.id);

  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const submit = () => {
    if (title.trim()) {
      create.mutate(title.trim());
      setTitle("");
      setAdding(false);
    }
  };

  const done = subtasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {subtasks.length > 0 ? `${done} of ${subtasks.length} complete` : "No subtasks"}
        </span>
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add subtask
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-1">
          {subtasks.map((t) => {
            const isDone = t.status === "done";
            return (
              <li key={t.id} className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                <Checkbox
                  checked={isDone}
                  onCheckedChange={(c) => toggle.mutate({ id: t.id, done: !!c })}
                />
                <span className={cn("flex-1 text-sm", isDone && "text-muted-foreground line-through")}>{t.title}</span>
                <button
                  className="opacity-0 transition group-hover:opacity-100"
                  onClick={() => { if (confirm("Delete subtask?")) remove.mutate(t.id); }}
                  aria-label="Delete subtask"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") { setAdding(false); setTitle(""); }
            }}
            placeholder="Subtask title…"
            className="h-8"
          />
          <Button size="sm" onClick={submit}>Add</Button>
        </div>
      )}
    </div>
  );
}
