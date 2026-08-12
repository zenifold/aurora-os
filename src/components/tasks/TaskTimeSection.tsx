import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Play, Square, Trash2, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  useActiveTimer,
  useStartTimer,
  useStopTimer,
  useCancelTimer,
  useTaskTimeLogs,
  useLogTime,
  useDeleteTimeLog,
} from "@/hooks/use-time-tracking";
import { useUpdateTask } from "@/hooks/use-tasks";
import type { Task } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

function formatElapsed(startedAt: string, now: number) {
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TaskTimeSection({ task }: { task: Task }) {
  const { user } = useAuth();
  const update = useUpdateTask(task.project_id);
  const { data: activeTimer } = useActiveTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const cancel = useCancelTimer();
  const { data: logs = [] } = useTaskTimeLogs(task.id);
  const log = useLogTime();
  const removeLog = useDeleteTimeLog();

  const [now, setNow] = useState(Date.now());
  const [estimate, setEstimate] = useState<string>(
    (task as unknown as { estimated_hours?: number | null }).estimated_hours?.toString() ?? "",
  );
  const [hours, setHours] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);

  const timerForThisTask = activeTimer && activeTimer.task_id === task.id ? activeTimer : null;
  const timerForOtherTask = activeTimer && activeTimer.task_id !== task.id ? activeTimer : null;

  useEffect(() => {
    if (!timerForThisTask) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timerForThisTask]);

  const totalLogged = logs.reduce((acc, l) => acc + Number(l.hours || 0), 0);
  const myLogged = logs.filter((l) => l.user_id === user?.id).reduce((acc, l) => acc + Number(l.hours || 0), 0);
  const estimateNum = Number((task as unknown as { estimated_hours?: number | null }).estimated_hours ?? 0);
  const overBudget = estimateNum > 0 && totalLogged > estimateNum;

  return (
    <div className="space-y-6">
      {/* Timer */}
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4" /> Timer
        </div>
        {timerForThisTask ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-mono text-2xl tabular-nums">{formatElapsed(timerForThisTask.started_at, now)}</div>
            <Button size="sm" onClick={() => stop.mutate(timerForThisTask)} disabled={stop.isPending}>
              <Square className="mr-1 h-3 w-3" /> Stop & log
            </Button>
            <Button size="sm" variant="ghost" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              Discard
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {timerForOtherTask && (
              <p className="text-xs text-muted-foreground">
                A timer is already running on another task. Stop it first to track this one.
              </p>
            )}
            <Button
              size="sm"
              onClick={() => start.mutate({ taskId: task.id, projectId: task.project_id })}
              disabled={start.isPending || !!timerForOtherTask}
            >
              <Play className="mr-1 h-3 w-3" /> Start timer
            </Button>
          </div>
        )}
      </div>

      {/* Estimate */}
      <div className="space-y-2">
        <Label htmlFor="estimate">Estimated hours</Label>
        <div className="flex gap-2">
          <Input
            id="estimate"
            type="number"
            min={0}
            step={0.25}
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            onBlur={() => {
              const n = estimate === "" ? null : Number(estimate);
              update.mutate({ id: task.id, estimated_hours: n } as never);
            }}
            placeholder="—"
            className="w-32"
          />
          <div className="flex items-center text-sm text-muted-foreground">
            Logged: <span className={`ml-1 font-medium ${overBudget ? "text-destructive" : "text-foreground"}`}>{totalLogged.toFixed(2)}h</span>
            {estimateNum > 0 && <span className="ml-1">/ {estimateNum}h</span>}
            <span className="ml-2 text-xs">(you: {myLogged.toFixed(2)}h)</span>
          </div>
        </div>
      </div>

      {/* Manual log */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="text-sm font-medium">Log time</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Hours</Label>
            <Input
              type="number"
              min={0}
              step={0.25}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="1.5"
            />
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={billable} onCheckedChange={setBillable} id="billable" />
            <Label htmlFor="billable" className="text-xs">Billable</Label>
          </div>
        </div>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you work on?" />
        <Button
          size="sm"
          onClick={() => {
            const h = Number(hours);
            if (!(h > 0)) return;
            log.mutate(
              { taskId: task.id, projectId: task.project_id, hours: h, logDate, description, isBillable: billable },
              {
                onSuccess: () => {
                  setHours("");
                  setDescription("");
                },
              },
            );
          }}
          disabled={log.isPending || !(Number(hours) > 0)}
        >
          Add entry
        </Button>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Entries</div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time logged yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">{Number(l.hours).toFixed(2)}h</span>
                    <span className="text-xs text-muted-foreground">{format(parseISO(l.log_date), "MMM d")}</span>
                    {!l.is_billable && <span className="text-xs text-muted-foreground">· non-billable</span>}
                  </div>
                  {l.description && <div className="truncate text-xs text-muted-foreground">{l.description}</div>}
                </div>
                {l.user_id === user?.id && (
                  <Button size="icon" variant="ghost" onClick={() => removeLog.mutate(l.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
