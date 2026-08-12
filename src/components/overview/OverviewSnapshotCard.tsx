import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OverviewSectionContent, OverviewHealth } from "@/lib/overview-types";
import ReactMarkdown from "react-markdown";

const HEALTH_META: Record<OverviewHealth, { label: string; color: string }> = {
  on_track: { label: "On track", color: "var(--status-success, #16a34a)" },
  at_risk: { label: "At risk", color: "var(--status-warning, #f59e0b)" },
  off_track: { label: "Off track", color: "var(--status-danger, #dc2626)" },
  unknown: { label: "Unknown", color: "var(--muted-foreground)" },
};

export function HealthBadge({ health }: { health: OverviewHealth | null }) {
  const m = HEALTH_META[health ?? "unknown"];
  return (
    <Badge variant="outline" style={{ color: m.color, borderColor: m.color }}>
      {m.label}
    </Badge>
  );
}

export function OverviewSectionCard({ section }: { section: OverviewSectionContent }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span aria-hidden>{section.icon}</span> {section.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{section.content_md}</ReactMarkdown>
      </CardContent>
    </Card>
  );
}
