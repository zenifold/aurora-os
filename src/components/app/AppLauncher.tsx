import { Link, useRouterState } from "@tanstack/react-router";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  UsersRound,
  CalendarRange,
  LineChart,
  AlertTriangle,
  Sparkles,
  Briefcase,
  Users,
  Clock,
  Mic,
  StickyNote,
  Activity,
  DollarSign,
  TrendingUp,
  FileText,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useNavVisibility } from "@/hooks/use-nav-visibility";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { isNavHiddenByMode } from "@/lib/workspace-mode-nav";
import { useClientContainers } from "@/hooks/use-containers";
import { cn } from "@/lib/utils";

type AppLink = {
  key: string;
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  gated?: boolean;
  kinds?: Array<"sales" | "delivery" | "hybrid">;
};

const APPS: AppLink[] = [
  { key: "timesheet", to: "/app/timesheet", label: "Timesheet", icon: Clock },
  { key: "notes", to: "/app/notes", label: "Notes", icon: StickyNote },
  { key: "meetings", to: "/app/meetings", label: "Meetings", icon: Mic },
  { key: "portfolio-status", to: "/app/portfolio-status", label: "Portfolio", icon: Activity },
  { key: "activity", to: "/app/activity", label: "Activity", icon: Activity },
  { key: "documents", to: "/app/documents", label: "Documents", icon: FileText },
  { key: "clients", to: "/app/clients", label: "Clients", icon: Briefcase, kinds: ["sales", "hybrid"] },
  { key: "pipeline-analytics", to: "/app/pipeline-analytics", label: "Pipeline analytics", icon: TrendingUp, gated: true, kinds: ["sales", "hybrid"] },
  { key: "resources", to: "/app/resources", label: "Resources", icon: UsersRound, gated: true },
  { key: "capacity", to: "/app/resources/capacity", label: "Capacity", icon: CalendarRange, gated: true },
  { key: "finance", to: "/app/finance", label: "Finance", icon: DollarSign, gated: true },
  { key: "forecast", to: "/app/forecast", label: "Forecast", icon: LineChart, gated: true },
  { key: "executive", to: "/app/executive", label: "Executive", icon: LineChart, gated: true },
  { key: "escalations", to: "/app/escalations", label: "Escalations", icon: AlertTriangle, gated: true },
  { key: "agent-runs", to: "/app/agent-runs", label: "Agent runs", icon: Sparkles },
  { key: "approvals", to: "/app/approvals", label: "Approval inbox", icon: ShieldCheck },
  { key: "triggers", to: "/app/triggers", label: "Agent triggers", icon: Zap },
];

export function AppLauncher() {
  const ws = useWorkspaceStore((s) => s.current);
  const { canSee } = useNavVisibility();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const clientContainers = useClientContainers();
  const hasAnyClient = clientContainers.length > 0;

  const items = APPS.filter((a) => {
    if (a.kinds && !a.kinds.includes(ws?.kind ?? "hybrid")) return false;
    if (isNavHiddenByMode(a.key, ws?.workspace_mode, hasAnyClient)) return false;
    if (a.gated && !canSee(a.key)) return false;
    return true;
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="App launcher" title="Apps">
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Apps
        </div>
        <div className="grid grid-cols-3 gap-1">
          {items.map((a) => {
            const Icon = a.icon;
            const active = path.startsWith(a.to);
            return (
              <Link
                key={a.key}
                to={a.to}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg p-3 text-center text-xs transition-colors",
                  active
                    ? "bg-aura-gradient-subtle text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="leading-tight">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
