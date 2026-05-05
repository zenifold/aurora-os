import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CustomFieldDef, Task } from "@/lib/types";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/types";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
import { RichEditor } from "./RichEditor";
import { RecurrencePicker } from "./RecurrencePicker";
import { CommentsThread } from "./CommentsThread";
import { SubtasksList } from "./SubtasksList";
import { ActivityFeed } from "./ActivityFeed";
import { TaskAiPanel } from "./TaskAiPanel";
import { TaskRelationsSection } from "./TaskRelationsSection";
import { ApprovalsPanel } from "./ApprovalsPanel";
import { Sparkles } from "lucide-react";
import { PresenceStack } from "@/components/app/PresenceStack";
import { usePresence } from "@/hooks/use-presence";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile-breakpoint";

export function TaskDetailPanel({ projectId, taskId, onClose, fields }: { projectId: string; taskId: string | null; onClose: () => void; fields: CustomFieldDef[] }) {
  const update = useUpdateTask(projectId);
  const remove = useDeleteTask(projectId);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { users: viewers } = usePresence(taskId ? `presence:task:${taskId}` : null, {
    display_name: user?.email?.split("@")[0],
  });

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

  useEffect(() => {
    if (task) setTitle(task.title);
  }, [task]);

  if (!task) {
    return (
      <Sheet open={!!taskId} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "h-[92vh] w-full max-w-full p-0 pt-safe" : "w-full sm:max-w-2xl"}
        >
          <SheetHeader><SheetTitle>Loading…</SheetTitle></SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const status = STATUS_OPTIONS.find((s) => s.value === task.status);

  return (
    <Sheet open={!!taskId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "flex h-[92vh] w-full max-w-full flex-col overflow-hidden p-0 pt-safe"
            : "flex w-full flex-col overflow-hidden p-0 sm:max-w-2xl"
        }
      >
        <SheetHeader className="space-y-3 border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status?.color }} />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{status?.label}</span>
            </div>
            {viewers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {viewers.length === 1 ? "1 viewer" : `${viewers.length} viewers`}
                </span>
                <PresenceStack users={viewers} max={3} />
              </div>
            )}
          </div>
          <SheetTitle className="sr-only">Task details</SheetTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title !== task.title) update.mutate({ id: task.id, title }); }}
            className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
          />
        </SheetHeader>

        <div className="grid grid-cols-2 gap-4 border-b border-border px-6 py-4">
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
          <FieldRow label="Repeat">
            <RecurrencePicker
              value={task.recurrence ?? null}
              onChange={(rule) =>
                update.mutate({ id: task.id, recurrence: rule as never })
              }
            />
          </FieldRow>
        </div>

        <Tabs defaultValue="description" className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 w-fit">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="mr-1 h-3 w-3" />AI</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="description" className="mt-0 space-y-5">
              <RichEditor
                content={task.description}
                placeholder="Add more details…"
                onBlur={(json) => update.mutate({ id: task.id, description: json as never })}
              />

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

              <ApprovalsPanel task={task} />
              <TaskRelationsSection task={task} />
            </TabsContent>

            <TabsContent value="subtasks" className="mt-0">
              <SubtasksList parent={task} />
            </TabsContent>

            <TabsContent value="comments" className="mt-0">
              <CommentsThread taskId={task.id} />
            </TabsContent>

            <TabsContent value="ai" className="mt-0">
              <TaskAiPanel task={task} />
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <ActivityFeed taskId={task.id} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-between border-t border-border px-6 py-3">
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
