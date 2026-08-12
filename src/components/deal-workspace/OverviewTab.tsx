import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, AlertTriangle, ListChecks, Users, FileText, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  listDealActivities, createDealActivity,
  listDealDocuments, listDealResources,
} from "@/lib/deal-workspace.functions";
import { listDealDependencies, listDealRequirements } from "@/lib/requirements.functions";
import { toast } from "sonner";

type Deal = {
  id: string; title: string; description: string | null;
  value: number | null; currency: string; status: string;
  expected_close_date: string | null; probability: number;
};

export function OverviewTab({ deal }: { deal: Deal }) {
  const dealId = deal.id;
  const acts = useServerFn(listDealActivities);
  const create = useServerFn(createDealActivity);
  const reqs = useServerFn(listDealRequirements);
  const deps = useServerFn(listDealDependencies);
  const docs = useServerFn(listDealDocuments);
  const res = useServerFn(listDealResources);
  const qc = useQueryClient();

  const { data: activities = [] } = useQuery({ queryKey: ["deal-activities", dealId], queryFn: () => acts({ data: { deal_id: dealId } }) });
  const { data: requirements = [] } = useQuery({ queryKey: ["deal-requirements", dealId], queryFn: () => reqs({ data: { deal_id: dealId } }) });
  const { data: dependencies = [] } = useQuery({ queryKey: ["deal-dependencies", dealId], queryFn: () => deps({ data: { deal_id: dealId } }) });
  const { data: documents = [] } = useQuery({ queryKey: ["deal-docs", dealId], queryFn: () => docs({ data: { deal_id: dealId } }) });
  const { data: resources = [] } = useQuery({ queryKey: ["deal-resources", dealId], queryFn: () => res({ data: { deal_id: dealId } }) });

  const [note, setNote] = useState("");
  const noteMut = useMutation({
    mutationFn: () => create({ data: { deal_id: dealId, activity_type: "note", content: note } }),
    onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["deal-activities", dealId] }); toast.success("Note added"); },
  });

  const blockers = dependencies.filter((d) => d.status === "blocked" || d.status === "at_risk");
  const criticalReqs = requirements.filter((r) => r.priority === "critical" || r.priority === "high");

  const fmt = deal.value != null
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: deal.currency || "USD", maximumFractionDigits: 0 }).format(deal.value)
    : "—";

  return (
    <div className="grid gap-4 lg:grid-cols-3 max-w-7xl">
      {/* Pulse stats */}
      <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Value" value={fmt} />
        <Stat label="Confidence" value={`${deal.probability}%`} />
        <Stat label="Close date" value={deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : "—"} />
        <Stat label="Requirements" value={String(requirements.length)} icon={ListChecks} />
        <Stat label="Documents" value={String(documents.length)} icon={FileText} />
      </div>

      {/* Description / AI brief placeholder */}
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">Opportunity brief</h3>
          <Badge variant="outline" className="text-xs">Auto-summary</Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {deal.description || "No description yet. As you capture requirements, plans, and pricing, this brief will become the single source of truth for the deal."}
          {requirements.length > 0 && (
            <span> {requirements.length} requirements captured ({criticalReqs.length} critical/high).</span>
          )}
          {resources.length > 0 && <span> {resources.length} roles proposed.</span>}
          {blockers.length > 0 && <span className="text-destructive"> {blockers.length} blocking dependencies.</span>}
        </p>
      </Card>

      {/* Blockers */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Blockers
        </h3>
        {blockers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active blockers.</p>
        ) : (
          <ul className="space-y-2">
            {blockers.slice(0, 5).map((b) => (
              <li key={b.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-[10px] capitalize">{b.status}</Badge>
                  <span className="truncate">{b.title}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Activity */}
      <Card className="p-5 lg:col-span-2">
        <h3 className="font-semibold flex items-center gap-2 mb-3"><Activity className="h-4 w-4" /> Recent activity</h3>
        <div className="flex gap-2 mb-3">
          <Textarea placeholder="Add a note, decision, or update..." rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="resize-none" />
          <Button size="icon" className="self-end" disabled={!note.trim() || noteMut.isPending} onClick={() => noteMut.mutate()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Activity will appear here as the team captures notes and documents.</p>
        ) : (
          <ul className="space-y-3">
            {activities.slice(0, 8).map((a) => (
              <li key={a.id} className="text-sm border-l-2 border-border pl-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] capitalize">{a.activity_type}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{a.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Team mini */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-3"><Users className="h-4 w-4" /> Proposed team</h3>
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles staged.</p>
        ) : (
          <ul className="space-y-1.5">
            {resources.slice(0, 6).map((r) => (
              <li key={r.id} className="text-sm flex items-center justify-between gap-2">
                <span className="truncate">{r.role}</span>
                {r.hours && <span className="text-xs text-muted-foreground shrink-0">{r.hours}h</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}{label}
      </div>
      <div className="mt-1 font-semibold text-lg truncate">{value}</div>
    </Card>
  );
}
