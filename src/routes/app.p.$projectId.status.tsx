import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  Send,
  Trash2,
  Plus,
  Star,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  useStatusUpdates,
  useStatusUpdate,
  useSaveStatusUpdate,
  usePublishStatusUpdate,
  useDeleteStatusUpdate,
  useAiDraftStatusUpdate,
  useProjectCsat,
  type StatusHealth,
} from "@/hooks/use-status-updates";
import { useProject } from "@/hooks/use-projects";
import { ScheduleStatusReportButton } from "@/components/projects/ScheduleStatusReportButton";

export const Route = createFileRoute("/app/p/$projectId/status")({
  component: StatusUpdatesPage,
});

const HEALTH_LABEL: Record<StatusHealth, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  complete: "Complete",
};
const HEALTH_CLASS: Record<StatusHealth, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  off_track: "bg-destructive/15 text-destructive",
  complete: "bg-primary/15 text-primary",
};

interface DraftState {
  id: string | null;
  period_start: string;
  period_end: string;
  health: StatusHealth;
  headline: string;
  summary: string;
  accomplishments: string;
  next_period: string;
  risks: string;
  asks: string;
  visibility: "internal" | "client" | "both";
  ai_generated: boolean;
}

function emptyDraft(): DraftState {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86_400_000);
  return {
    id: null,
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
    health: "on_track",
    headline: "",
    summary: "",
    accomplishments: "",
    next_period: "",
    risks: "",
    asks: "",
    visibility: "internal",
    ai_generated: false,
  };
}

function StatusUpdatesPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: updates = [], isLoading } = useStatusUpdates(projectId);
  const { data: csat } = useProjectCsat(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);

  const { data: full } = useStatusUpdate(projectId, selectedId);
  const save = useSaveStatusUpdate(projectId);
  const publish = usePublishStatusUpdate(projectId);
  const del = useDeleteStatusUpdate(projectId);
  const aiDraft = useAiDraftStatusUpdate();

  // Sync draft when a row is selected
  useEffect(() => {
    if (full && selectedId) {
      const r = full as unknown as DraftState & Record<string, string>;
      setDraft({
        id: selectedId,
        period_start: r.period_start ?? "",
        period_end: r.period_end ?? "",
        health: (r.health as StatusHealth) ?? "on_track",
        headline: r.headline ?? "",
        summary: r.summary ?? "",
        accomplishments: r.accomplishments ?? "",
        next_period: r.next_period ?? "",
        risks: r.risks ?? "",
        asks: r.asks ?? "",
        visibility: (r.visibility as DraftState["visibility"]) ?? "internal",
        ai_generated: Boolean(r.ai_generated),
      });
    }
  }, [full, selectedId]);

  const update = <K extends keyof DraftState>(k: K, v: DraftState[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleNew = () => {
    setSelectedId(null);
    setDraft(emptyDraft());
  };

  const handleAiDraft = async () => {
    try {
      const d = await aiDraft.mutateAsync({
        project_id: projectId,
        period_start: draft.period_start,
        period_end: draft.period_end,
      });
      setDraft((prev) => ({
        ...prev,
        ...d,
        id: prev.id,
        visibility: prev.visibility,
        ai_generated: true,
      }));
      toast.success("AI draft ready — review and publish");
    } catch (e) {
      toast.error((e as Error).message || "Could not generate draft");
    }
  };

  const handleSave = async (publishAfter = false) => {
    try {
      const r = await save.mutateAsync({
        id: draft.id ?? undefined,
        project_id: projectId,
        period_start: draft.period_start || null,
        period_end: draft.period_end || null,
        health: draft.health,
        headline: draft.headline || null,
        summary: draft.summary || null,
        accomplishments: draft.accomplishments || null,
        next_period: draft.next_period || null,
        risks: draft.risks || null,
        asks: draft.asks || null,
        visibility: draft.visibility,
        ai_generated: draft.ai_generated,
      });
      const id = (r as { id: string | null }).id ?? draft.id;
      if (id) {
        setDraft((d) => ({ ...d, id }));
        setSelectedId(id);
        if (publishAfter) {
          await publish.mutateAsync(id);
          toast.success("Status update published");
        } else {
          toast.success("Draft saved");
        }
      }
    } catch (e) {
      toast.error((e as Error).message || "Save failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this status update?")) return;
    await del.mutateAsync(id);
    if (selectedId === id) handleNew();
    toast.success("Deleted");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/app/p/$projectId"
            params={{ projectId }}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
            {project?.name ?? "Project"}
          </Link>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold lg:text-xl">Status updates</h1>
            <p className="text-xs text-muted-foreground">
              Publish weekly updates to your team and client portal. Pull a fresh AI draft anytime.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {csat && csat.count > 0 && (
              <div className="hidden items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs sm:flex">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium">{csat.avg?.toFixed(1) ?? "—"}</span>
                <span className="text-muted-foreground">· {csat.count} CSAT</span>
              </div>
            )}
            <ScheduleStatusReportButton projectId={projectId} />
            <Button size="sm" variant="outline" onClick={handleNew}>
              <Plus className="mr-1.5 h-4 w-4" /> New
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* List */}
        <aside className="overflow-auto border-b border-border lg:border-b-0 lg:border-r">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : updates.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No status updates yet. Create one or generate an AI draft.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {updates.map((u) => {
                const active = u.id === selectedId;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(u.id)}
                      className={`group flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition-colors hover:bg-accent ${
                        active ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          {u.headline || "Untitled update"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] ${HEALTH_CLASS[u.health]}`}
                        >
                          {HEALTH_LABEL[u.health]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {u.period_start && u.period_end
                            ? `${u.period_start} → ${u.period_end}`
                            : new Date(u.created_at).toLocaleDateString()}
                        </span>
                        <span className="uppercase tracking-wider">
                          {u.status === "published" ? "Published" : "Draft"}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Editor */}
        <section className="overflow-auto p-4 lg:p-6">
          <Card className="mx-auto max-w-3xl space-y-5 p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                {draft.id ? "Edit status update" : "New status update"}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAiDraft}
                  disabled={aiDraft.isPending}
                >
                  {aiDraft.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4 text-primary" />
                  )}
                  AI draft
                </Button>
                {draft.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(draft.id!)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Period start</Label>
                <Input
                  type="date"
                  value={draft.period_start}
                  onChange={(e) => update("period_start", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Period end</Label>
                <Input
                  type="date"
                  value={draft.period_end}
                  onChange={(e) => update("period_end", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Health</Label>
                <Select
                  value={draft.health}
                  onValueChange={(v) => update("health", v as StatusHealth)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(HEALTH_LABEL) as StatusHealth[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {HEALTH_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Visibility</Label>
                <Select
                  value={draft.visibility}
                  onValueChange={(v) =>
                    update("visibility", v as DraftState["visibility"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal only</SelectItem>
                    <SelectItem value="client">Client portal</SelectItem>
                    <SelectItem value="both">Internal + client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Headline</Label>
              <Input
                value={draft.headline}
                onChange={(e) => update("headline", e.target.value)}
                placeholder="One-line summary of the week"
                maxLength={280}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Summary</Label>
              <Textarea
                value={draft.summary}
                onChange={(e) => update("summary", e.target.value)}
                rows={3}
                placeholder="2–4 sentences in plain English"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Accomplishments</Label>
                <Textarea
                  value={draft.accomplishments}
                  onChange={(e) => update("accomplishments", e.target.value)}
                  rows={5}
                  placeholder="- Shipped …\n- Resolved …"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Next period</Label>
                <Textarea
                  value={draft.next_period}
                  onChange={(e) => update("next_period", e.target.value)}
                  rows={5}
                  placeholder="- Will deliver …\n- Will start …"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Risks / blockers</Label>
                <Textarea
                  value={draft.risks}
                  onChange={(e) => update("risks", e.target.value)}
                  rows={4}
                  placeholder="None"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Asks from client</Label>
                <Textarea
                  value={draft.asks}
                  onChange={(e) => update("asks", e.target.value)}
                  rows={4}
                  placeholder="None"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {draft.ai_generated ? "Drafted with AI · review before publishing" : " "}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={save.isPending}
                >
                  {save.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : null}
                  Save draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={save.isPending || publish.isPending}
                >
                  {publish.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-4 w-4" />
                  )}
                  Publish
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
