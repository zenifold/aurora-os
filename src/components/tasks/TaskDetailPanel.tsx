import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CustomFieldDef, Task } from "@/lib/types";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/types";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { Trash2, Calendar as CalendarIcon } from "lucide-react";

export function TaskDetailPanel({ projectId, taskId, onClose, fields }: { projectId: string; taskId: string | null; onClose: () => void; fields: CustomFieldDef[] }) {
  const update = useUpdateTask(projectId);
  const remove = useDeleteTask(projectId);

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId!).single();
      if (error) throw error;
      return data as Task;
    },
  });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      const d = task.description as { text?: string } | null;
      setDesc(typeof d === "object" && d?.text ? d.text : "");
    }
  }, [task]);

  if (!task) {
    return (
      <Sheet open={!!taskId} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader><SheetTitle>Loading…</SheetTitle></SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const status = STATUS_OPTIONS.find((s) => s.value === task.status);

  return (
    <Sheet open={!!taskId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status?.color }} />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{status?.label}</span>
          </div>
          <SheetTitle className="sr-only">Task details</SheetTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title !== task.title) update.mutate({ id: task.id, title }); }}
            className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
          />
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Status">
              <Select value={task.status} onValueChange={(v) => update.mutate({ id: task.id, status: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Priority">
              <Select value={task.priority} onValueChange={(v) => update.mutate({ id: task.id, priority: v as Task["priority"] })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Due date">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-full justify-start font-normal">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : "Set date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={task.due_date ? parseISO(task.due_date) : undefined}
                    onSelect={(d) => update.mutate({ id: task.id, due_date: d ? format(d, "yyyy-MM-dd") : null })}
                  />
                </PopoverContent>
              </Popover>
            </FieldRow>
            <FieldRow label="Start date">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-full justify-start font-normal">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {task.start_date ? format(parseISO(task.start_date), "MMM d, yyyy") : "Set date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={task.start_date ? parseISO(task.start_date) : undefined}
                    onSelect={(d) => update.mutate({ id: task.id, start_date: d ? format(d, "yyyy-MM-dd") : null })}
                  />
                </PopoverContent>
              </Popover>
            </FieldRow>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => update.mutate({ id: task.id, description: { text: desc } as never })}
              placeholder="Add more details…"
              className="mt-1.5 min-h-32"
            />
          </div>

          {fields.length > 0 && (
            <div>
              <Label>Custom fields</Label>
              <div className="mt-2 space-y-2">
                {fields.map((f) => (
                  <div key={f.id} className="flex items-center gap-3">
                    <span className="w-32 text-xs text-muted-foreground">{f.name}</span>
                    <span className="text-sm">{String(task.custom_values?.[f.id] ?? "—")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="font-mono text-xs text-muted-foreground">{task.id.slice(0, 8)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                if (confirm("Delete this task?")) {
                  remove.mutate(task.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
