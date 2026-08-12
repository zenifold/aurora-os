import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useStatusSchedule,
  useUpsertStatusSchedule,
  useDeleteStatusSchedule,
} from "@/hooks/use-status-schedule";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Props {
  projectId: string;
}

export function ScheduleStatusReportButton({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const { data: schedule, isLoading } = useStatusSchedule(projectId);
  const upsert = useUpsertStatusSchedule(projectId);
  const del = useDeleteStatusSchedule(projectId);

  const [cadence, setCadence] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(5);
  const [hourUtc, setHourUtc] = useState(14);
  const [visibility, setVisibility] = useState<"internal" | "client" | "both">("internal");
  const [autoPublish, setAutoPublish] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (schedule) {
      setCadence(schedule.cadence);
      setDayOfWeek(schedule.day_of_week);
      setHourUtc(schedule.hour_utc);
      setVisibility(schedule.visibility);
      setAutoPublish(schedule.auto_publish);
      setActive(schedule.active);
    }
  }, [schedule]);

  const isOn = !!schedule && schedule.active;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarClock className="mr-1.5 h-4 w-4" />
          {isOn ? "Schedule on" : "Schedule"}
          {isOn && (
            <Badge variant="outline" className="ml-2 text-[10px]">
              {schedule!.cadence}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Automated status reports</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aurora will draft a status update from project activity on a recurring schedule
              and either save it as a draft or auto-publish to your chosen audience.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cadence</Label>
                <Select value={cadence} onValueChange={(v) => setCadence(v as typeof cadence)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Day of week</Label>
                <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Hour (UTC)</Label>
                <Select value={String(hourUtc)} onValueChange={(v) => setHourUtc(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00 UTC</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal only</SelectItem>
                    <SelectItem value="client">Client portal</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <Label className="flex items-center justify-between text-xs">
                <span>Auto-publish (skip draft review)</span>
                <Switch checked={autoPublish} onCheckedChange={setAutoPublish} />
              </Label>
              <Label className="flex items-center justify-between text-xs">
                <span>Schedule active</span>
                <Switch checked={active} onCheckedChange={setActive} />
              </Label>
            </div>

            {schedule?.next_run_at && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <div>Next run: {new Date(schedule.next_run_at).toLocaleString()}</div>
                {schedule.last_run_at && (
                  <div>Last run: {new Date(schedule.last_run_at).toLocaleString()}</div>
                )}
                {schedule.last_error && (
                  <div className="text-destructive">Last error: {schedule.last_error}</div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          <div>
            {schedule && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  if (!confirm("Remove this schedule?")) return;
                  await del.mutateAsync();
                  setOpen(false);
                  toast.success("Schedule removed");
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await upsert.mutateAsync({
                    project_id: projectId,
                    cadence,
                    day_of_week: dayOfWeek,
                    hour_utc: hourUtc,
                    visibility,
                    auto_publish: autoPublish,
                    active,
                  });
                  toast.success("Schedule saved");
                  setOpen(false);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Save schedule
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
