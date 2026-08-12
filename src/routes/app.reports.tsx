import { createFileRoute, Link } from "@tanstack/react-router";
import { LineChart, TrendingUp, Activity, DollarSign, UsersRound, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

const REPORTS = [
  { to: "/app/executive", label: "Executive overview", desc: "Portfolio health and leadership KPIs.", icon: LineChart },
  { to: "/app/pipeline-analytics", label: "Pipeline analytics", desc: "Deal flow, conversion, and forecast accuracy.", icon: TrendingUp },
  { to: "/app/forecast", label: "Forecast", desc: "Revenue and capacity outlook.", icon: LineChart },
  { to: "/app/portfolio-status", label: "Portfolio status", desc: "Status across every active engagement.", icon: Activity },
  { to: "/app/finance", label: "Finance", desc: "Margin, WIP, and billing.", icon: DollarSign },
  { to: "/app/resources/capacity", label: "Capacity", desc: "Utilization and resourcing.", icon: UsersRound },
  { to: "/app/escalations", label: "Escalations", desc: "Risks and blockers needing attention.", icon: AlertTriangle },
] as const;

function ReportsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Role-scoped views across pipeline, utilization, delivery health, and forecast.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.to} to={r.to}>
              <Card className="flex items-start gap-3 p-4 transition-colors hover:bg-accent/40">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aura-gradient-subtle">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{r.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
