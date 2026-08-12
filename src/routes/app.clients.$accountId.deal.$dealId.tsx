import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, FileText, ListChecks, Link2, Users, ClipboardList,
  LayoutDashboard, DollarSign, Check, KanbanSquare, Rocket, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

import { getClientAccount } from "@/lib/clients.functions";
import { updateDealCore } from "@/lib/deal-workspace.functions";
import { convertWonDealToEngagement } from "@/lib/deals.functions";
import { OverviewTab } from "@/components/deal-workspace/OverviewTab";
import { DocumentsTab } from "@/components/deal-workspace/DocumentsTab";
import { PlansTab } from "@/components/deal-workspace/PlansTab";
import { ProjectTab } from "@/components/deal-workspace/ProjectTab";
import { ResourcesTab } from "@/components/deal-workspace/ResourcesTab";
import { ValueTab } from "@/components/deal-workspace/ValueTab";
import { DealRequirements, DealDependencies } from "@/components/deal-workspace/RequirementsDependenciesTabs";
import { toast } from "sonner";

type Deal = {
  id: string; title: string; description: string | null;
  value: number | null; currency: string; status: string;
  client_account_id: string | null; expected_close_date: string | null;
  handed_off_project_id: string | null; probability: number;
};

export const Route = createFileRoute("/app/clients/$accountId/deal/$dealId")({
  component: DealPage,
});

function DealPage() {
  const { accountId, dealId } = Route.useParams();
  const navigate = useNavigate();
  const getAccount = useServerFn(getClientAccount);
  const update = useServerFn(updateDealCore);
  const convertDeal = useServerFn(convertWonDealToEngagement);
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [spinOpen, setSpinOpen] = useState(false);

  const { data: deal } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id,title,description,value,currency,status,client_account_id,expected_close_date,handed_off_project_id,probability")
        .eq("id", dealId).single();
      if (error) throw error;
      return data as Deal;
    },
  });

  const { data: account } = useQuery({
    queryKey: ["client-account", accountId],
    queryFn: () => getAccount({ data: { id: accountId } }),
  });

  const statusMut = useMutation({
    mutationFn: (status: "open" | "won" | "lost") => update({ data: { id: dealId, status } }),
    onSuccess: (_d, status) => {
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      toast.success(`Marked ${status}`);
    },
  });

  const spinUp = useMutation({
    mutationFn: (project_name: string) =>
      convertDeal({ data: { deal_id: dealId, project_name, create_contract: false } }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      setSpinOpen(false);
      toast.success(res?.existed ? "Opened existing project" : "Project created");
      if (res?.project_id) navigate({ to: "/app/p/$projectId", params: { projectId: res.project_id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create project"),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <Link to="/app/clients" className="hover:text-foreground">Clients</Link>
          <span>/</span>
          <Link to="/app/clients/$accountId" params={{ accountId }} className="hover:text-foreground">
            {account?.account?.name ?? "Client"}
          </Link>
          <span>/</span>
          <span className="text-foreground">{deal?.title ?? "Opportunity"}</span>
        </div>
        <div className="flex items-start gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link to="/app/clients/$accountId" params={{ accountId }}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setEditOpen(true)}
                className="group inline-flex items-center gap-1.5 text-left rounded px-1 -mx-1 hover:bg-accent/60 transition-colors max-w-full"
              >
                <h1 className="font-display text-lg sm:text-xl font-semibold tracking-tight truncate">{deal?.title ?? "Deal"}</h1>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 [@media(hover:none)]:opacity-100 shrink-0" />
              </button>
              {deal && (
                <Badge variant={deal.status === "won" ? "default" : deal.status === "lost" ? "destructive" : "secondary"} className="capitalize">
                  {deal.status}
                </Badge>
              )}
              {deal?.value != null && (
                <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {new Intl.NumberFormat(undefined, { style: "currency", currency: deal.currency || "USD", maximumFractionDigits: 0 }).format(deal.value)}
                </span>
              )}
              {deal?.handed_off_project_id && (
                <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs">
                  <Link to="/app/p/$projectId" params={{ projectId: deal.handed_off_project_id }}>
                    <Rocket className="h-3 w-3 mr-1" /> Open project
                  </Link>
                </Button>
              )}
            </div>
            {/* Mobile actions row */}
            <div className="mt-2 flex flex-wrap gap-2 sm:hidden">
              {deal && !deal.handed_off_project_id && (
                <Button variant="outline" size="sm" onClick={() => setSpinOpen(true)} className="flex-1 min-w-[120px]">
                  <Rocket className="h-4 w-4 mr-1" /> Spin up
                </Button>
              )}
              {deal && deal.status !== "won" && deal.status !== "lost" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => statusMut.mutate("lost")} className="flex-1 min-w-[80px]">Lost</Button>
                  <Button size="sm" onClick={() => statusMut.mutate("won")} className="flex-1 min-w-[80px]">
                    <Check className="h-4 w-4 mr-1" /> Won
                  </Button>
                </>
              )}
              {deal?.status === "won" && (
                <Button variant="outline" size="sm" onClick={() => statusMut.mutate("open")} className="flex-1">Reopen</Button>
              )}
            </div>
          </div>
          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {deal && !deal.handed_off_project_id && (
              <Button variant="outline" size="sm" onClick={() => setSpinOpen(true)}>
                <Rocket className="h-4 w-4 mr-1" /> Spin up project
              </Button>
            )}
            {deal && deal.status !== "won" && deal.status !== "lost" && (
              <>
                <Button variant="outline" size="sm" onClick={() => statusMut.mutate("lost")}>Mark lost</Button>
                <Button size="sm" onClick={() => statusMut.mutate("won")}>
                  <Check className="h-4 w-4 mr-1" /> Mark won
                </Button>
              </>
            )}
            {deal?.status === "won" && (
              <Button variant="outline" size="sm" onClick={() => statusMut.mutate("open")}>Reopen</Button>
            )}
          </div>
        </div>
      </div>

      {deal && (
        <EditDealDialog
          deal={deal}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSave={async (patch) => {
            await update({ data: { id: dealId, ...patch } });
            qc.invalidateQueries({ queryKey: ["deal", dealId] });
            setEditOpen(false);
            toast.success("Saved");
          }}
        />
      )}

      {deal && (
        <SpinUpProjectDialog
          defaultName={deal.title}
          open={spinOpen}
          onOpenChange={setSpinOpen}
          loading={spinUp.isPending}
          onConfirm={(name) => spinUp.mutate(name)}
        />
      )}

      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border px-2 sm:px-4 lg:px-6 overflow-x-auto no-scrollbar">
          <TabsList className="bg-transparent h-auto p-0 flex w-max gap-0">
            <TabsTrigger value="overview" className="whitespace-nowrap"><LayoutDashboard className="h-4 w-4 mr-1.5" />Overview</TabsTrigger>
            <TabsTrigger value="documents" className="whitespace-nowrap"><FileText className="h-4 w-4 mr-1.5" />Documents</TabsTrigger>
            <TabsTrigger value="plans" className="whitespace-nowrap"><ClipboardList className="h-4 w-4 mr-1.5" />Plans</TabsTrigger>
            <TabsTrigger value="project" className="whitespace-nowrap"><KanbanSquare className="h-4 w-4 mr-1.5" />Project</TabsTrigger>
            <TabsTrigger value="resources" className="whitespace-nowrap"><Users className="h-4 w-4 mr-1.5" />Resources</TabsTrigger>
            <TabsTrigger value="requirements" className="whitespace-nowrap"><ListChecks className="h-4 w-4 mr-1.5" />Requirements</TabsTrigger>
            <TabsTrigger value="dependencies" className="whitespace-nowrap"><Link2 className="h-4 w-4 mr-1.5" />Dependencies</TabsTrigger>
            <TabsTrigger value="value" className="whitespace-nowrap"><DollarSign className="h-4 w-4 mr-1.5" />Value</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          <TabsContent value="overview" className="mt-0">
            {deal && <OverviewTab deal={deal} />}
          </TabsContent>
          <TabsContent value="documents" className="mt-0"><DocumentsTab dealId={dealId} /></TabsContent>
          <TabsContent value="plans" className="mt-0"><PlansTab dealId={dealId} /></TabsContent>
          <TabsContent value="project" className="mt-0"><ProjectTab dealId={dealId} /></TabsContent>
          <TabsContent value="resources" className="mt-0"><ResourcesTab dealId={dealId} /></TabsContent>
          <TabsContent value="requirements" className="mt-0"><DealRequirements dealId={dealId} /></TabsContent>
          <TabsContent value="dependencies" className="mt-0"><DealDependencies dealId={dealId} /></TabsContent>
          <TabsContent value="value" className="mt-0">
            <ValueTab dealId={dealId} currency={deal?.currency || "USD"} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

type DealPatch = Partial<Pick<Deal, "title" | "value" | "currency" | "description" | "expected_close_date" | "probability">>;

function EditDealDialog({ deal, open, onOpenChange, onSave }: {
  deal: Deal; open: boolean; onOpenChange: (v: boolean) => void;
  onSave: (patch: DealPatch) => Promise<void>;
}) {
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState<string>(deal.value != null ? String(deal.value) : "");
  const [currency, setCurrency] = useState(deal.currency || "USD");
  const [description, setDescription] = useState(deal.description ?? "");
  const [closeDate, setCloseDate] = useState(deal.expected_close_date ?? "");
  const [probability, setProbability] = useState<string>(String(deal.probability ?? 0));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) { setTitle(deal.title); setValue(deal.value != null ? String(deal.value) : ""); setCurrency(deal.currency || "USD"); setDescription(deal.description ?? ""); setCloseDate(deal.expected_close_date ?? ""); setProbability(String(deal.probability ?? 0)); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit opportunity</DialogTitle>
          <DialogDescription>Update the deal's core details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Opportunity name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What's the project about?" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Value</label>
              <Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Probability %</label>
              <Input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Expected close</label>
              <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!title.trim()}
            onClick={() => onSave({
              title: title.trim(),
              value: value === "" ? null : Number(value),
              currency: currency.trim() || "USD",
              description: description.trim() || null,
              expected_close_date: closeDate || null,
              probability: probability === "" ? 0 : Number(probability),
            })}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpinUpProjectDialog({ defaultName, open, onOpenChange, loading, onConfirm }: {
  defaultName: string; open: boolean; onOpenChange: (v: boolean) => void;
  loading: boolean; onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) setName(defaultName); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Spin up project</DialogTitle>
          <DialogDescription>
            Promotes this opportunity into an active engagement. All requirements, plans, tasks, and documents stay linked.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Project name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim() || loading} onClick={() => onConfirm(name.trim())}>
            <Rocket className="h-4 w-4 mr-1" /> {loading ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
