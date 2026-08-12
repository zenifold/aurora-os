import { Battery, BatteryLow, BatteryMedium, BatteryFull } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export function EngagementBattery({
  score,
  breakdown,
}: {
  score: number;
  breakdown?: Record<string, unknown> | null;
}) {
  const color =
    score >= 80
      ? "text-emerald-500"
      : score >= 50
        ? "text-amber-500"
        : "text-red-500";
  const Icon = score >= 80 ? BatteryFull : score >= 50 ? BatteryMedium : score >= 20 ? BatteryLow : Battery;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className={`text-xs font-semibold ${color}`}>{score}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Engagement score</h4>
          <p className="text-xs text-muted-foreground">
            Computed nightly from portal activity, logins, and pending approvals.
          </p>
          {breakdown && (
            <dl className="text-xs space-y-1 pt-2 border-t border-border">
              {Object.entries(breakdown).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt>
                  <dd>{v == null ? "—" : String(v).slice(0, 30)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
