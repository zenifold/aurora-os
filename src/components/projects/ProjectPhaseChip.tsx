import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { listEngagementPhases } from "@/lib/phases.functions";
import { useVocabulary } from "@/hooks/use-vocabulary";

type Phase = {
  id: string;
  name: string;
  color: string | null;
  order_index: number;
  status: "planned" | "active" | "completed" | "skipped";
};

/**
 * Compact chip showing the active phase of an engagement.
 * Renders nothing when the project has no phases (freeform engagement).
 */
export function ProjectPhaseChip({ projectId, noLink = false }: { projectId: string; noLink?: boolean }) {
  const vocab = useVocabulary();
  const listFn = useServerFn(listEngagementPhases);
  const { data = [] } = useQuery({
    queryKey: ["engagement-phases", projectId],
    queryFn: () => listFn({ data: { project_id: projectId } }) as Promise<Phase[]>,
  });

  if (!data.length) return null;

  const active = data.find((p) => p.status === "active");
  const total = data.length;
  const completed = data.filter((p) => p.status === "completed").length;
  const current = active ?? data[Math.min(completed, total - 1)];
  const color = current.color ?? "hsl(var(--primary))";
  const title = `${vocab.phase.singular}: ${current.name} (${completed + 1}/${total})`;
  const className = "group inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:bg-muted";

  const inner = (
    <>
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ background: color, boxShadow: active ? `0 0 0 2px ${color}33` : undefined }}
        aria-hidden
      />
      <Layers className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
      <span className="font-medium truncate max-w-[12rem]">{current.name}</span>
      <span className="text-muted-foreground tabular-nums">
        {completed + (active ? 1 : 0)}/{total}
      </span>
    </>
  );

  if (noLink) {
    return <span title={title} className={className}>{inner}</span>;
  }

  return (
    <Link to="/app/p/$projectId/phases" params={{ projectId }} title={title} className={className}>
      {inner}
    </Link>
  );
}
