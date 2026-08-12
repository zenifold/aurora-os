import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Loader2, Sparkles, Check, ChevronRight, FileText, ExternalLink, Quote } from "lucide-react";
import {
  useHandover,
  useDraftBrief,
  useUpdateBrief,
  useApproveBrief,
  type DiscoveryBrief,
  type BriefCitation,
} from "@/hooks/use-handover";
import type { HandoverStage } from "@/lib/handover.functions";
import { SalesDocumentCenter, ExtractedInsightsSummary } from "@/components/sales/SalesDocumentCenter";
import { SowDraftPanel } from "@/components/sales/SowDraftPanel";
import { ScopeChecklistPanel } from "@/components/sales/ScopeChecklistPanel";
import { DeliverablesHub } from "@/components/sales/DeliverablesHub";
import { useSalesDocuments, useDownloadSalesDoc } from "@/hooks/use-sales-documents";

const STAGES: { key: HandoverStage; label: string }[] = [
  { key: "discovery", label: "Discovery" },
  { key: "sow_draft", label: "SOW Draft" },
  { key: "sow_internal_review", label: "Internal Review" },
  { key: "sow_customer_review", label: "Customer Review" },
  { key: "signed", label: "Signed" },
  { key: "plan_draft", label: "Plan Draft" },
  { key: "plan_review", label: "Plan Review" },
  { key: "executing", label: "Executing" },
  { key: "delivered", label: "Delivered" },
];

export function HandoverPanel({ dealId }: { dealId: string }) {
  const { data, isLoading } = useHandover(dealId);
  const draft = useDraftBrief(dealId);

  if (isLoading) {
    return (
      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        Loading handover…
      </div>
    );
  }

  const handover = data?.handover ?? null;
  const brief = data?.brief ?? null;
  const currentStage: HandoverStage = handover?.stage ?? "discovery";

  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Agentic handover
          </div>
          <div className="text-xs text-muted-foreground">
            Agents draft each artifact; humans review and approve at every gate.
          </div>
        </div>
      </div>

      <DeliverablesHub dealId={dealId} />

      <StageTracker current={currentStage} />

      {currentStage === "discovery" && (
        <>
          <SalesDocumentCenter dealId={dealId} />
          <DiscoveryStage
            dealId={dealId}
            brief={brief}
            onDraft={(extra) => draft.mutate(extra)}
            drafting={draft.isPending}
          />
          {brief && <ScopeChecklistPanel dealId={dealId} canApply={false} />}
        </>
      )}

      {(currentStage === "sow_draft" ||
        currentStage === "sow_internal_review" ||
        currentStage === "sow_customer_review") && (
        <>
          <ScopeChecklistPanel dealId={dealId} canApply={true} />
          <SowDraftPanel dealId={dealId} />
        </>
      )}

      {currentStage !== "discovery" &&
        currentStage !== "sow_draft" &&
        currentStage !== "sow_internal_review" &&
        currentStage !== "sow_customer_review" && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Stage: <strong>{STAGES.find((s) => s.key === currentStage)?.label}</strong> — next agentic step coming soon.
          </div>
        )}
    </div>
  );
}

function StageTracker({ current }: { current: HandoverStage }) {
  const currentIdx = STAGES.findIndex((s) => s.key === current);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STAGES.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <Badge
              variant={active ? "default" : done ? "secondary" : "outline"}
              className="text-[10px] font-medium"
            >
              {done && <Check className="mr-1 h-3 w-3" />}
              {s.label}
            </Badge>
            {i < STAGES.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DiscoveryStage({
  dealId,
  brief,
  onDraft,
  drafting,
}: {
  dealId: string;
  brief: DiscoveryBrief | null;
  onDraft: (extra?: string) => void;
  drafting: boolean;
}) {
  const [extra, setExtra] = useState("");
  const { data: docs = [] } = useSalesDocuments(dealId);


  if (!brief) {
    return (
      <div className="space-y-2 rounded-md border border-dashed border-border p-3">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <FileText className="h-4 w-4" /> No discovery brief yet
        </div>
        <p className="text-xs text-muted-foreground">
          Have an AI business analyst synthesize a discovery brief from the deal data, activities,
          primary contact, and any scanned documents above. You can edit and approve before
          moving to SOW drafting.
        </p>
        <ExtractedInsightsSummary docs={docs} />
        <Textarea
          placeholder="Optional: extra context not yet captured in documents…"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={3}
          className="text-xs"
        />
        <Button onClick={() => onDraft(extra || undefined)} disabled={drafting}>
          {drafting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Draft discovery brief
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ExtractedInsightsSummary docs={docs} />
      <BriefEditor dealId={dealId} brief={brief} onRedraft={() => onDraft(undefined)} redrafting={drafting} />
    </div>
  );
}


function BriefEditor({
  dealId,
  brief,
  onRedraft,
  redrafting,
}: {
  dealId: string;
  brief: DiscoveryBrief;
  onRedraft: () => void;
  redrafting: boolean;
}) {
  const update = useUpdateBrief(dealId);
  const approve = useApproveBrief(dealId);
  const [local, setLocal] = useState({
    business_goals: brief.business_goals ?? "",
    target_users: brief.target_users ?? "",
    scope_summary: brief.scope_summary ?? "",
    constraints: brief.constraints ?? "",
    tech_preferences: brief.tech_preferences ?? "",
    success_metrics: brief.success_metrics ?? "",
    unknowns: (brief.unknowns ?? []).join("\n"),
  });
  const readonly = brief.status === "approved";

  const save = () => {
    update.mutate({
      id: brief.id,
      patch: {
        ...local,
        unknowns: local.unknowns.split("\n").map((s) => s.trim()).filter(Boolean),
      },
    });
  };

  const docs = useSalesDocuments(dealId).data ?? [];
  const docName = (id: string) => docs.find((d) => d.id === id)?.name ?? "document";
  const download = useDownloadSalesDoc();

  const F = (key: keyof typeof local, label: string, rows = 3) => {
    const cites = brief.citations?.[key as string] ?? [];
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">{label}</Label>
          {cites.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cites.map((c: BriefCitation, i: number) => (
                <CitationChip
                  key={i}
                  citation={c}
                  docName={docName(c.document_id)}
                  onOpen={() => download.mutate(c.document_id)}
                />
              ))}
            </div>
          )}
        </div>
        <Textarea
          value={local[key]}
          onChange={(e) => setLocal((p) => ({ ...p, [key]: e.target.value }))}
          onBlur={save}
          rows={rows}
          disabled={readonly}
          className="text-xs"
        />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">
          Discovery brief v{brief.version}{" "}
          <Badge variant={readonly ? "secondary" : "outline"} className="ml-1 text-[10px]">
            {brief.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {!readonly && (
            <Button size="sm" variant="ghost" onClick={onRedraft} disabled={redrafting}>
              {redrafting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Redraft
            </Button>
          )}
          {!readonly && (
            <Button
              size="sm"
              onClick={() => approve.mutate(brief.id)}
              disabled={approve.isPending}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Approve & start SOW
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {F("business_goals", "Business goals")}
        {F("target_users", "Target users")}
        {F("scope_summary", "Scope summary", 4)}
        {F("constraints", "Constraints")}
        {F("tech_preferences", "Tech preferences", 2)}
        {F("success_metrics", "Success metrics", 2)}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Unknowns (one question per line)</Label>
        <Textarea
          value={local.unknowns}
          onChange={(e) => setLocal((p) => ({ ...p, unknowns: e.target.value }))}
          onBlur={save}
          rows={5}
          disabled={readonly}
          className="text-xs font-mono"
        />
      </div>
    </div>
  );
}

function CitationChip({
  citation,
  docName,
  onOpen,
}: {
  citation: BriefCitation;
  docName: string;
  onOpen: () => void;
}) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/20"
        >
          <FileText className="h-2.5 w-2.5" />
          <span className="max-w-[10rem] truncate">{docName}</span>
          {citation.section && (
            <span className="text-muted-foreground">· {citation.section}</span>
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="end" className="w-80 space-y-2 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 font-medium">
            <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{docName}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1.5 text-[10px]"
            onClick={onOpen}
          >
            Open <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
        {citation.section && (
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Section: <span className="normal-case text-foreground">{citation.section}</span>
          </div>
        )}
        <blockquote className="flex gap-1.5 rounded border-l-2 border-primary/50 bg-muted/40 p-2 text-[11px] italic text-foreground">
          <Quote className="h-3 w-3 shrink-0 text-primary/70" />
          <span>"{citation.snippet}"</span>
        </blockquote>
      </HoverCardContent>
    </HoverCard>
  );
}
