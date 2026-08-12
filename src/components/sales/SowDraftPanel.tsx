import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2,
  Sparkles,
  Check,
  Wand2,
  Send,
  FileText,
  ChevronDown,
} from "lucide-react";
import {
  useSowDraft,
  useDraftSow,
  useRegenerateSection,
  useUpdateSection,
  useSetSowStatus,
  type SowDraft,
} from "@/hooks/use-sow";
import { SOW_SECTIONS, type SowSectionKey } from "@/lib/sow.functions";

export function SowDraftPanel({ dealId }: { dealId: string }) {
  const { data: sow, isLoading } = useSowDraft(dealId);
  const draft = useDraftSow(dealId);

  if (isLoading) {
    return (
      <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
        Loading SOW…
      </div>
    );
  }

  if (!sow) {
    return (
      <div className="space-y-2 rounded-md border border-dashed border-border p-3">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <FileText className="h-4 w-4" /> No SOW drafted yet
        </div>
        <p className="text-xs text-muted-foreground">
          An AI delivery principal will synthesize the discovery brief, sales documents, and deal
          context into a complete SOW covering strategy, positioning, value, scope, technical
          architecture, deliverables, team, timeline, financials, risks and terms. You can edit
          any section or regenerate it with instructions.
        </p>
        <Button onClick={() => draft.mutate()} disabled={draft.isPending}>
          {draft.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Draft SOW from brief
        </Button>
      </div>
    );
  }

  return <SowEditor dealId={dealId} sow={sow} onRedraft={() => draft.mutate()} redrafting={draft.isPending} />;
}

function SowEditor({
  dealId,
  sow,
  onRedraft,
  redrafting,
}: {
  dealId: string;
  sow: SowDraft;
  onRedraft: () => void;
  redrafting: boolean;
}) {
  const setStatus = useSetSowStatus(dealId);
  const locked = sow.status === "approved" || sow.status === "signed";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold">{sow.title}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant={locked ? "secondary" : "outline"} className="text-[10px]">
              v{sow.version} · {sow.status.replace("_", " ")}
            </Badge>
            {sow.client_name && <span>· {sow.client_name}</span>}
            {sow.financials?.total && (
              <span>
                · {sow.financials.currency ?? "USD"} {Number(sow.financials.total).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!locked && (
            <>
              <Button size="sm" variant="ghost" onClick={onRedraft} disabled={redrafting}>
                {redrafting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                Redraft all
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus.mutate({ sow_id: sow.id, status: "internal_review" })}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" /> Send to internal review
              </Button>
              <Button
                size="sm"
                onClick={() => setStatus.mutate({ sow_id: sow.id, status: "customer_review" })}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Send to customer
              </Button>
            </>
          )}
          {sow.status === "customer_review" && (
            <Button
              size="sm"
              onClick={() => setStatus.mutate({ sow_id: sow.id, status: "signed" })}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Mark signed
            </Button>
          )}
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["executive_summary", "financials"]} className="space-y-2">
        {SOW_SECTIONS.map((s) => (
          <SectionAccordion
            key={s.key}
            dealId={dealId}
            sow={sow}
            sectionKey={s.key}
            label={s.label}
            kind={s.kind}
            locked={locked}
          />
        ))}
      </Accordion>
    </div>
  );
}

function SectionAccordion({
  dealId,
  sow,
  sectionKey,
  label,
  kind,
  locked,
}: {
  dealId: string;
  sow: SowDraft;
  sectionKey: SowSectionKey;
  label: string;
  kind: string;
  locked: boolean;
}) {
  const meta = sow.section_meta?.[sectionKey];
  return (
    <AccordionItem
      value={sectionKey}
      className="rounded-md border border-border bg-card px-3"
    >
      <AccordionTrigger className="py-3 hover:no-underline">
        <div className="flex items-center gap-2 text-left">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
          <span className="text-sm font-medium">{label}</span>
          {meta?.ai_generated_at && (
            <Badge variant="secondary" className="text-[9px]">
              <Sparkles className="mr-0.5 h-2.5 w-2.5" /> AI
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <SectionEditor
          dealId={dealId}
          sow={sow}
          sectionKey={sectionKey}
          kind={kind}
          locked={locked}
        />
      </AccordionContent>
    </AccordionItem>
  );
}

function SectionEditor({
  dealId,
  sow,
  sectionKey,
  kind,
  locked,
}: {
  dealId: string;
  sow: SowDraft;
  sectionKey: SowSectionKey;
  kind: string;
  locked: boolean;
}) {
  const regen = useRegenerateSection(dealId);
  const update = useUpdateSection(dealId);
  const [instruction, setInstruction] = useState("");

  const value = (sow as unknown as Record<string, unknown>)[sectionKey];

  return (
    <div className="space-y-3 pb-2">
      {kind === "text" && (
        <TextSection
          value={typeof value === "string" ? value : ""}
          locked={locked}
          onSave={(v) => update.mutate({ sow_id: sow.id, patch: { [sectionKey]: v } })}
        />
      )}
      {kind === "list" && (
        <ListSection
          value={Array.isArray(value) ? (value as string[]) : []}
          locked={locked}
          onSave={(v) => update.mutate({ sow_id: sow.id, patch: { [sectionKey]: v } })}
        />
      )}
      {kind === "deliverables" && (
        <DeliverablesSection
          value={sow.deliverables}
          locked={locked}
          onSave={(v) => update.mutate({ sow_id: sow.id, patch: { deliverables: v } })}
        />
      )}
      {kind === "team" && (
        <TeamSection
          value={sow.team_composition}
          locked={locked}
          onSave={(v) => update.mutate({ sow_id: sow.id, patch: { team_composition: v } })}
        />
      )}
      {kind === "timeline" && (
        <TimelineSection
          value={sow.timeline}
          locked={locked}
          onSave={(v) => update.mutate({ sow_id: sow.id, patch: { timeline: v } })}
        />
      )}
      {kind === "financials" && (
        <FinancialsSection
          value={sow.financials}
          locked={locked}
          onSave={(v) => update.mutate({ sow_id: sow.id, patch: { financials: v } })}
        />
      )}
      {kind === "risks" && (
        <RisksSection
          value={sow.risks}
          locked={locked}
          onSave={(v) => update.mutate({ sow_id: sow.id, patch: { risks: v } })}
        />
      )}

      {!locked && (
        <div className="flex gap-2 border-t border-border pt-2">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional instruction for AI (e.g. 'shorten', 'more technical', 'add HIPAA')"
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={regen.isPending}
            onClick={() =>
              regen.mutate(
                {
                  sow_id: sow.id,
                  section: sectionKey,
                  instruction: instruction || undefined,
                },
                { onSuccess: () => setInstruction("") },
              )
            }
          >
            {regen.isPending && regen.variables?.section === sectionKey ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Regenerate
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Sub-editors ---------------- */

function TextSection({
  value,
  locked,
  onSave,
}: {
  value: string;
  locked: boolean;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <Textarea
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      rows={Math.max(4, Math.min(16, v.split("\n").length + 1))}
      disabled={locked}
      className="text-xs font-mono"
      placeholder="Markdown content…"
    />
  );
}

function ListSection({
  value,
  locked,
  onSave,
}: {
  value: string[];
  locked: boolean;
  onSave: (v: string[]) => void;
}) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <Textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const arr = text.split("\n").map((s) => s.trim()).filter(Boolean);
        if (JSON.stringify(arr) !== JSON.stringify(value)) onSave(arr);
      }}
      rows={Math.max(3, Math.min(12, text.split("\n").length + 1))}
      disabled={locked}
      className="text-xs"
      placeholder="One item per line"
    />
  );
}

function DeliverablesSection({
  value,
  locked,
  onSave,
}: {
  value: SowDraft["deliverables"];
  locked: boolean;
  onSave: (v: SowDraft["deliverables"]) => void;
}) {
  const update = (idx: number, patch: Partial<SowDraft["deliverables"][number]>) => {
    const next = value.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onSave(next);
  };
  return (
    <div className="space-y-2">
      {value.map((d, i) => (
        <Card key={i} className="space-y-1 p-2">
          <Input
            value={d.name ?? ""}
            disabled={locked}
            onChange={(e) => update(i, { name: e.target.value })}
            className="h-7 text-xs font-medium"
            placeholder="Deliverable name"
          />
          <Textarea
            value={d.description ?? ""}
            disabled={locked}
            onChange={(e) => update(i, { description: e.target.value })}
            rows={2}
            className="text-xs"
            placeholder="Description"
          />
          <Input
            value={d.acceptance_criteria ?? ""}
            disabled={locked}
            onChange={(e) => update(i, { acceptance_criteria: e.target.value })}
            className="h-7 text-xs"
            placeholder="Acceptance criteria"
          />
        </Card>
      ))}
      {!locked && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onSave([...value, { name: "", description: "", acceptance_criteria: "" }])}
        >
          + Add deliverable
        </Button>
      )}
    </div>
  );
}

function TeamSection({
  value,
  locked,
  onSave,
}: {
  value: SowDraft["team_composition"];
  locked: boolean;
  onSave: (v: SowDraft["team_composition"]) => void;
}) {
  const update = (idx: number, patch: Partial<SowDraft["team_composition"][number]>) => {
    onSave(value.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-1 text-[10px] font-medium text-muted-foreground">
        <span className="col-span-5">Role</span>
        <span className="col-span-1">#</span>
        <span className="col-span-2">% alloc</span>
        <span className="col-span-4">Rationale</span>
      </div>
      {value.map((m, i) => (
        <div key={i} className="grid grid-cols-12 gap-1">
          <Input value={m.role ?? ""} disabled={locked} onChange={(e) => update(i, { role: e.target.value })} className="col-span-5 h-7 text-xs" />
          <Input type="number" value={m.count ?? 1} disabled={locked} onChange={(e) => update(i, { count: Number(e.target.value) })} className="col-span-1 h-7 text-xs" />
          <Input type="number" value={m.allocation_pct ?? 100} disabled={locked} onChange={(e) => update(i, { allocation_pct: Number(e.target.value) })} className="col-span-2 h-7 text-xs" />
          <Input value={m.rationale ?? ""} disabled={locked} onChange={(e) => update(i, { rationale: e.target.value })} className="col-span-4 h-7 text-xs" />
        </div>
      ))}
      {!locked && (
        <Button size="sm" variant="ghost" onClick={() => onSave([...value, { role: "", count: 1, allocation_pct: 100, rationale: "" }])}>
          + Add role
        </Button>
      )}
    </div>
  );
}

function TimelineSection({
  value,
  locked,
  onSave,
}: {
  value: SowDraft["timeline"];
  locked: boolean;
  onSave: (v: SowDraft["timeline"]) => void;
}) {
  const update = (idx: number, patch: Partial<SowDraft["timeline"][number]>) => {
    onSave(value.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };
  const totalWeeks = value.reduce((s, p) => s + (p.weeks ?? 0), 0);
  return (
    <div className="space-y-2">
      {value.map((p, i) => (
        <Card key={i} className="space-y-1 p-2">
          <div className="flex gap-1">
            <Input value={p.phase ?? ""} disabled={locked} onChange={(e) => update(i, { phase: e.target.value })} className="h-7 text-xs font-medium" placeholder="Phase" />
            <Input type="number" value={p.weeks ?? 0} disabled={locked} onChange={(e) => update(i, { weeks: Number(e.target.value) })} className="h-7 w-20 text-xs" placeholder="weeks" />
          </div>
          <Textarea
            value={(p.milestones ?? []).join("\n")}
            disabled={locked}
            onChange={(e) => update(i, { milestones: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            rows={2}
            className="text-xs"
            placeholder="Milestones (one per line)"
          />
        </Card>
      ))}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Total: {totalWeeks} weeks</span>
        {!locked && (
          <Button size="sm" variant="ghost" onClick={() => onSave([...value, { phase: "", weeks: 1, milestones: [] }])}>
            + Add phase
          </Button>
        )}
      </div>
    </div>
  );
}

function FinancialsSection({
  value,
  locked,
  onSave,
}: {
  value: SowDraft["financials"];
  locked: boolean;
  onSave: (v: SowDraft["financials"]) => void;
}) {
  const f = value ?? {};
  const items = f.line_items ?? [];
  const schedule = f.payment_schedule ?? [];

  const updateItem = (i: number, patch: Partial<NonNullable<SowDraft["financials"]["line_items"]>[number]>) => {
    const next = items.map((it, idx) => {
      if (idx !== i) return it;
      const merged = { ...it, ...patch };
      merged.amount = (merged.qty ?? 1) * (merged.rate ?? 0);
      return merged;
    });
    const subtotal = next.reduce((s, it) => s + (it.amount ?? 0), 0);
    const total = subtotal - (f.discount ?? 0);
    onSave({ ...f, line_items: next, subtotal, total });
  };

  const updatePayment = (i: number, patch: Partial<NonNullable<SowDraft["financials"]["payment_schedule"]>[number]>) => {
    onSave({ ...f, payment_schedule: schedule.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Currency</Label>
          <Input value={f.currency ?? "USD"} disabled={locked} onChange={(e) => onSave({ ...f, currency: e.target.value })} className="h-7 w-20 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Discount</Label>
          <Input
            type="number"
            value={f.discount ?? 0}
            disabled={locked}
            onChange={(e) => {
              const discount = Number(e.target.value);
              const subtotal = items.reduce((s, it) => s + (it.amount ?? 0), 0);
              onSave({ ...f, discount, subtotal, total: subtotal - discount });
            }}
            className="h-7 w-24 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Line items</Label>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-1">
            <Input value={it.name ?? ""} disabled={locked} onChange={(e) => updateItem(i, { name: e.target.value })} className="col-span-6 h-7 text-xs" placeholder="Name" />
            <Input type="number" value={it.qty ?? 1} disabled={locked} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })} className="col-span-2 h-7 text-xs" placeholder="Qty" />
            <Input type="number" value={it.rate ?? 0} disabled={locked} onChange={(e) => updateItem(i, { rate: Number(e.target.value) })} className="col-span-2 h-7 text-xs" placeholder="Rate" />
            <Input type="number" value={it.amount ?? 0} disabled className="col-span-2 h-7 text-xs" />
          </div>
        ))}
        {!locked && (
          <Button size="sm" variant="ghost" onClick={() => onSave({ ...f, line_items: [...items, { name: "", qty: 1, rate: 0, amount: 0 }] })}>
            + Add line item
          </Button>
        )}
      </div>

      <div className="rounded-md bg-muted/40 p-2 text-xs">
        <div className="flex justify-between"><span>Subtotal</span><span>{(f.subtotal ?? 0).toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>-{(f.discount ?? 0).toLocaleString()}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span>{f.currency ?? "USD"} {(f.total ?? 0).toLocaleString()}</span></div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Payment schedule</Label>
        {schedule.map((p, i) => (
          <div key={i} className="grid grid-cols-12 gap-1">
            <Input value={p.milestone ?? ""} disabled={locked} onChange={(e) => updatePayment(i, { milestone: e.target.value })} className="col-span-7 h-7 text-xs" placeholder="Milestone" />
            <Input type="number" value={p.pct ?? 0} disabled={locked} onChange={(e) => updatePayment(i, { pct: Number(e.target.value), amount: ((f.total ?? 0) * Number(e.target.value)) / 100 })} className="col-span-2 h-7 text-xs" placeholder="%" />
            <Input type="number" value={p.amount ?? 0} disabled className="col-span-3 h-7 text-xs" />
          </div>
        ))}
        {!locked && (
          <Button size="sm" variant="ghost" onClick={() => onSave({ ...f, payment_schedule: [...schedule, { milestone: "", pct: 0, amount: 0 }] })}>
            + Add payment
          </Button>
        )}
      </div>

      <Textarea
        value={f.notes ?? ""}
        disabled={locked}
        onChange={(e) => onSave({ ...f, notes: e.target.value })}
        rows={2}
        className="text-xs"
        placeholder="Notes (taxes, expenses, etc.)"
      />
    </div>
  );
}

function RisksSection({
  value,
  locked,
  onSave,
}: {
  value: SowDraft["risks"];
  locked: boolean;
  onSave: (v: SowDraft["risks"]) => void;
}) {
  const update = (i: number, patch: Partial<SowDraft["risks"][number]>) => {
    onSave(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  return (
    <div className="space-y-2">
      {value.map((r, i) => (
        <Card key={i} className="space-y-1 p-2">
          <div className="flex gap-1">
            <Input value={r.risk ?? ""} disabled={locked} onChange={(e) => update(i, { risk: e.target.value })} className="h-7 flex-1 text-xs" placeholder="Risk" />
            <select
              value={r.impact ?? "medium"}
              disabled={locked}
              onChange={(e) => update(i, { impact: e.target.value })}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <Input value={r.mitigation ?? ""} disabled={locked} onChange={(e) => update(i, { mitigation: e.target.value })} className="h-7 text-xs" placeholder="Mitigation" />
        </Card>
      ))}
      {!locked && (
        <Button size="sm" variant="ghost" onClick={() => onSave([...value, { risk: "", impact: "medium", mitigation: "" }])}>
          + Add risk
        </Button>
      )}
    </div>
  );
}
