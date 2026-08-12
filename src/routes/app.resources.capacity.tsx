import { createFileRoute } from "@tanstack/react-router";
import { NavAccessGuard } from "@/components/app/NavAccessGuard";
import { useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { useResources, useAllocations } from "@/hooks/use-resources";
import { useTeamMembers } from "@/hooks/use-team";
import { useProjects } from "@/hooks/use-projects";
import { utilizationColor, utilizationLabel } from "@/lib/resource-types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/app/resources/capacity")({
  component: () => <NavAccessGuard navKey="capacity"><CapacityPlanner /></NavAccessGuard>,
});

function CapacityPlanner() {
  const [weekOffset, setWeekOffset] = useState(0);
  const baseMonday = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(baseMonday, i));
  const from = format(days[0], "yyyy-MM-dd");
  const to = format(days[6], "yyyy-MM-dd");

  const { data: resources = [] } = useResources();
  const { data: team = [] } = useTeamMembers();
  const { data: projects = [] } = useProjects();
  const { data: allocations = [] } = useAllocations({ from, to });

  type Row = { key: string; name: string; capacity: number; team_user_id?: string; resource_id?: string };
  const rows: Row[] = useMemo(() => {
    const r: Row[] = [];
    for (const tm of team) {
      r.push({ key: `tm:${tm.user_id}`, name: tm.role ?? "Team member", capacity: Number(tm.weekly_capacity_hours ?? 40), team_user_id: tm.user_id });
    }
    for (const res of resources) {
      r.push({ key: `r:${res.id}`, name: res.name, capacity: res.weekly_capacity_hours, resource_id: res.id });
    }
    return r;
  }, [team, resources]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Project";

  const dayHoursFor = (row: Row, day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dailyCap = row.capacity / 5;
    let hours = 0;
    const segs: { project: string; hours: number }[] = [];
    for (const a of allocations) {
      const matches = row.team_user_id ? a.team_member_user_id === row.team_user_id : a.resource_id === row.resource_id;
      if (!matches) continue;
      if (a.start_date > dayStr) continue;
      if (a.end_date && a.end_date < dayStr) continue;
      let h = 0;
      if (a.allocation_type === "full_time") h = dailyCap;
      else if (a.allocation_type === "percentage") h = (dailyCap * (a.percentage ?? 0)) / 100;
      else if (a.allocation_type === "fixed_hours") h = (Number(a.fixed_hours ?? 0)) / Math.max(1, ((new Date(a.end_date ?? day).getTime() - new Date(a.start_date).getTime()) / 86400000 + 1));
      hours += h;
      if (h > 0) segs.push({ project: projectName(a.project_id), hours: h });
    }
    const pct = dailyCap > 0 ? Math.round((hours / dailyCap) * 100) : 0;
    return { hours, pct, segs };
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Capacity</div>
            <h1 className="text-lg font-semibold lg:text-xl">
              Week of {format(baseMonday, "MMM d, yyyy")}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>This week</Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nothing to plan yet"
            description="Add team members and resources to see weekly utilization, allocations, and over-capacity warnings."
            primaryAction={{ label: "Add resources", to: "/app/resources" }}
            secondaryAction={{ label: "Invite teammates", to: "/app/settings/members" }}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-muted/40 p-2 text-left">Resource</th>
                  {days.map((d) => (
                    <th key={d.toISOString()} className="p-2 text-left">
                      {format(d, "EEE d")}
                    </th>
                  ))}
                  <th className="p-2 text-left">Week</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  let weekHours = 0;
                  return (
                    <tr key={row.key} className="border-b border-border last:border-0">
                      <td className="sticky left-0 z-10 bg-card p-2 align-top font-medium">
                        <div>{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.capacity}h cap</div>
                      </td>
                      {days.map((d) => {
                        const cell = dayHoursFor(row, d);
                        weekHours += cell.hours;
                        return (
                          <td key={d.toISOString()} className={`p-2 align-top ${utilizationColor(cell.pct)}`}>
                            <div className="text-xs font-semibold">{cell.hours.toFixed(1)}h</div>
                            <div className="text-[10px] text-muted-foreground">{utilizationLabel(cell.pct)}</div>
                            {cell.segs.slice(0, 2).map((s, i) => (
                              <div key={i} className="mt-0.5 truncate text-[10px]">{s.project}</div>
                            ))}
                          </td>
                        );
                      })}
                      <td className="p-2 align-top text-xs font-semibold">{weekHours.toFixed(1)}h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
