import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useDeals, useDealStages, useUpdateDeal, useCreateDeal, useDeleteDeal, useAddDealActivity, useDealActivities, useContacts } from "@/hooks/use-crm";
import { formatDealValue, type Deal, type DealStage, type Contact } from "@/lib/crm-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Loader2, DollarSign, TrendingUp, Trophy, Trash2, ArrowRightCircle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/crm")({
  component: CrmPage,
});

function CrmPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: stages = [], isLoading: stagesLoading } = useDealStages();
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const updateDeal = useUpdateDeal();
  const [creating, setCreating] = useState(false);
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const s of stages) map.set(s.id, []);
    for (const d of deals) {
      if (!map.has(d.stage_id)) map.set(d.stage_id, []);
      map.get(d.stage_id)!.push(d);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [stages, deals]);

  const stats = useMemo(() => {
    const open = deals.filter((d) => d.status === "open");
    const won = deals.filter((d) => d.status === "won");
    const pipelineValue = open.reduce((sum, d) => sum + (d.value ?? 0), 0);
    const weighted = open.reduce((sum, d) => sum + ((d.value ?? 0) * (d.probability / 100)), 0);
    const wonValue = won.reduce((sum, d) => sum + (d.value ?? 0), 0);
    return { open: open.length, won: won.length, pipelineValue, weighted, wonValue };
  }, [deals]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const dealId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const targetStageId = overId.startsWith("stage:") ? overId.slice(6) : null;
    if (!targetStageId) return;
    const deal = deals.find((d) => d.id === dealId);
    const stage = stages.find((s) => s.id === targetStageId);
    if (!deal || !stage || deal.stage_id === targetStageId) return;
    const patch: Partial<Deal> & { id: string } = {
      id: dealId,
      stage_id: targetStageId,
      probability: stage.default_probability,
      status: stage.stage_type === "won" ? "won" : stage.stage_type === "lost" ? "lost" : "open",
    };
    if (stage.stage_type === "won") patch.won_at = new Date().toISOString();
    if (stage.stage_type === "lost") patch.lost_at = new Date().toISOString();
    await updateDeal.mutateAsync(patch);
  };

  if (stagesLoading || dealsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{ws?.name}</div>
            <h1 className="text-lg font-semibold lg:text-xl">Sales pipeline</h1>
          </div>
          <CreateDealDialog
            stages={stages}
            open={creating}
            onOpenChange={setCreating}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New deal
              </Button>
            }
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <StatCard icon={TrendingUp} label="Open deals" value={String(stats.open)} />
          <StatCard icon={DollarSign} label="Pipeline value" value={formatDealValue(stats.pipelineValue)} />
          <StatCard icon={DollarSign} label="Weighted" value={formatDealValue(stats.weighted)} hint="probability-adjusted" />
          <StatCard icon={Trophy} label="Won this period" value={`${stats.won} · ${formatDealValue(stats.wonValue)}`} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto p-4 lg:p-6">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex h-full min-w-max gap-3">
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage.get(stage.id) ?? []}
                onOpenDeal={setOpenDealId}
              />
            ))}
          </div>
        </DndContext>
      </div>

      {openDealId && (
        <DealDetailDialog
          dealId={openDealId}
          stages={stages}
          onOpenChange={(o) => !o && setOpenDealId(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function StageColumn({
  stage,
  deals,
  onOpenDeal,
}: {
  stage: DealStage;
  deals: Deal[];
  onOpenDeal: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}` });
  const total = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30 ${isOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="text-sm font-semibold">{stage.name}</span>
          <span className="text-xs text-muted-foreground">{deals.length}</span>
        </div>
        <span className="text-xs text-muted-foreground">{formatDealValue(total)}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} onClick={() => onOpenDeal(d.id)} />
        ))}
        {deals.length === 0 && (
          <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            Drop deals here
          </div>
        )}
      </div>
    </div>
  );
}

function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`cursor-grab rounded-md border border-border bg-card p-3 text-left shadow-sm transition hover:shadow ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="text-sm font-medium">{deal.title}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {deal.value != null && <span className="font-medium text-foreground">{formatDealValue(deal.value, deal.currency)}</span>}
        <Badge variant="secondary" className="text-[10px]">{deal.probability}%</Badge>
        {deal.handed_off_project_id && (
          <Badge className="bg-emerald-500/15 text-[10px] text-emerald-600 dark:text-emerald-400">Handed off</Badge>
        )}
      </div>
      {deal.expected_close_date && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Close {format(new Date(deal.expected_close_date), "MMM d, yyyy")}
        </div>
      )}
    </div>
  );
}

function CreateDealDialog({
  stages,
  open,
  onOpenChange,
  trigger,
}: {
  stages: DealStage[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const create = useCreateDeal();
  const { data: contacts = [] } = useContacts();
  const firstOpen = stages.find((s) => s.stage_type === "open");
  const [form, setForm] = useState({
    title: "",
    stage_id: firstOpen?.id ?? "",
    value: "",
    expected_close_date: "",
    description: "",
    contact_id: "",
  });

  const submit = async () => {
    if (!form.title.trim() || !form.stage_id) return;
    const stage = stages.find((s) => s.id === form.stage_id);
    await create.mutateAsync({
      title: form.title.trim(),
      stage_id: form.stage_id,
      value: form.value ? Number(form.value) : null,
      expected_close_date: form.expected_close_date || null,
      description: form.description.trim() || null,
      contact_id: form.contact_id || null,
      probability: stage?.default_probability ?? 25,
    });
    setForm({ title: "", stage_id: firstOpen?.id ?? "", value: "", expected_close_date: "", description: "", contact_id: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="Acme website redesign"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={form.stage_id} onValueChange={(v) => setForm({ ...form, stage_id: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                min={0}
                placeholder="50000"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Expected close</Label>
            <Input
              type="date"
              value={form.expected_close_date}
              onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Contact</Label>
            <Select value={form.contact_id || "none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="No contact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No contact</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.company ? ` · ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Context, requirements, key contacts…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!form.title.trim() || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealDetailDialog({
  dealId,
  stages,
  onOpenChange,
}: {
  dealId: string;
  stages: DealStage[];
  onOpenChange: (o: boolean) => void;
}) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const navigate = useNavigate();
  const deal = useDeals().data?.find((d) => d.id === dealId);
  const update = useUpdateDeal();
  const remove = useDeleteDeal();
  const { data: activities = [] } = useDealActivities(dealId);
  const { data: contacts = [] } = useContacts();
  const addActivity = useAddDealActivity(dealId);
  const [note, setNote] = useState("");
  const [handingOff, setHandingOff] = useState(false);

  if (!deal) return null;
  const currentStage = stages.find((s) => s.id === deal.stage_id);

  const handoff = async () => {
    if (!ws || !user) return;
    if (!ws.linked_delivery_workspace_id) {
      toast.error("Link a delivery workspace in workspace settings first");
      return;
    }
    setHandingOff(true);
    try {
      // Create project in delivery workspace
      const { data: proj, error: pErr } = await supabase
        .from("projects")
        .insert({
          workspace_id: ws.linked_delivery_workspace_id,
          name: deal.title,
          color: "#10b981",
          icon: "rocket",
          created_by: user.id,
          description: deal.description ?? `Handed off from CRM deal • ${formatDealValue(deal.value, deal.currency)}`,
        })
        .select()
        .single();
      if (pErr) throw pErr;

      // Default view + financials seed
      await supabase.from("views").insert({
        workspace_id: ws.linked_delivery_workspace_id,
        project_id: proj.id,
        name: "All tasks",
        view_type: "table",
        is_default: true,
        config: {},
        filters: [],
        sorts: [],
        created_by: user.id,
      });

      if (deal.value) {
        await supabase.from("project_financials" as never).insert({
          project_id: proj.id,
          workspace_id: ws.linked_delivery_workspace_id,
          contract_value: deal.value,
          currency: deal.currency,
        } as never);
      }

      // Mark deal handed off
      await update.mutateAsync({
        id: deal.id,
        handed_off_project_id: proj.id,
        handed_off_at: new Date().toISOString(),
      });

      await addActivity.mutateAsync({
        activity_type: "system",
        content: `Handed off to delivery — project created`,
        metadata: { project_id: proj.id },
      });

      toast.success("Project created in delivery workspace");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Handoff failed");
    } finally {
      setHandingOff(false);
    }
  };

  const submitNote = async () => {
    if (!note.trim()) return;
    await addActivity.mutateAsync({ activity_type: "note", content: note.trim() });
    setNote("");
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{deal.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={deal.stage_id}
                onValueChange={(v) => {
                  const stage = stages.find((s) => s.id === v);
                  update.mutate({
                    id: deal.id,
                    stage_id: v,
                    probability: stage?.default_probability ?? deal.probability,
                    status: stage?.stage_type === "won" ? "won" : stage?.stage_type === "lost" ? "lost" : "open",
                  });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                defaultValue={deal.value ?? ""}
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  if (v !== deal.value) update.mutate({ id: deal.id, value: v });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Probability %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                defaultValue={deal.probability}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== deal.probability) update.mutate({ id: deal.id, probability: v });
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contact</Label>
            <Select
              value={deal.contact_id ?? "none"}
              onValueChange={(v) => update.mutate({ id: deal.id, contact_id: v === "none" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="No contact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No contact</SelectItem>
                {contacts.map((c: Contact) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.company ? ` · ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {deal.description && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">{deal.description}</div>
          )}

          {/* Handoff action */}
          {currentStage?.stage_type === "won" && !deal.handed_off_project_id && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Deal won — ready for delivery</div>
                  <div className="text-xs text-muted-foreground">
                    {ws?.linked_delivery_workspace_id
                      ? "Create a project in the linked delivery workspace and seed financials from this deal."
                      : "Link a delivery workspace in Settings → Workspace to enable handoff."}
                  </div>
                </div>
                <Button onClick={handoff} disabled={handingOff || !ws?.linked_delivery_workspace_id}>
                  {handingOff && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <ArrowRightCircle className="mr-2 h-4 w-4" /> Hand off
                </Button>
              </div>
            </div>
          )}

          {deal.handed_off_project_id && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              ✅ Handed off to delivery
              <Button
                variant="link"
                className="ml-2 h-auto p-0"
                onClick={() => navigate({ to: "/app/p/$projectId", params: { projectId: deal.handed_off_project_id! } })}
              >
                View project →
              </Button>
            </div>
          )}

          {/* Activity */}
          <div className="space-y-2">
            <Label>Activity</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a note…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitNote(); }}
              />
              <Button onClick={submitNote} disabled={!note.trim()}>
                <MessageSquare className="mr-2 h-4 w-4" /> Add
              </Button>
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {activities.map((a) => (
                <div key={a.id} className="rounded-md border border-border p-2 text-xs">
                  <div className="text-muted-foreground">{format(new Date(a.created_at), "MMM d, h:mm a")} · {a.activity_type}</div>
                  <div className="mt-0.5 text-sm">{a.content}</div>
                </div>
              ))}
              {activities.length === 0 && <div className="text-xs text-muted-foreground">No activity yet</div>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="text-destructive" onClick={async () => { await remove.mutateAsync(deal.id); onOpenChange(false); }}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
