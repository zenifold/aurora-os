import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getClientAccount, setClientAccountPrivacy } from "@/lib/clients.functions";
import {
  listSowsByClient,
  createSowForClient,
  renameSow,
  deleteSow,
  duplicateSow,
} from "@/lib/sow-client.functions";
import { renameContainer } from "@/lib/containers.functions";
import { listProjectTemplates } from "@/lib/templates.functions";
import { startOnboarding } from "@/lib/onboarding.functions";
import { generateArtifact } from "@/lib/ai-create.functions";
import { getClientHealthScore } from "@/lib/clients-mission.functions";
import { getClientPulse } from "@/lib/portal-activity.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { useCreateProject } from "@/hooks/use-projects";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Globe, Calendar, FolderOpen, FileText, Pencil, Sparkles, Plus, Lock, Unlock } from "lucide-react";
import { ClientCreateMenu } from "@/components/clients/ClientCreateMenu";
import { HealthRing } from "@/components/clients/mission-control/HealthRing";
import { EngagementBattery } from "@/components/clients/mission-control/EngagementBattery";
import { OverviewTab } from "@/components/clients/mission-control/OverviewTab";
import { PipelineTab } from "@/components/clients/mission-control/PipelineTab";
import { ProjectsTab } from "@/components/clients/mission-control/ProjectsTab";
import { DocumentsTab } from "@/components/clients/mission-control/DocumentsTab";
import { ContactsTab } from "@/components/clients/mission-control/ContactsTab";
import { PortalActivityTab } from "@/components/clients/mission-control/PortalActivityTab";
import { AiArtifactsTab } from "@/components/clients/mission-control/AiArtifactsTab";

export const Route = createFileRoute("/app/clients/$accountId")({
  component: AccountPage,
  loader: ({ context, params }) => {
    const qc = (context as { queryClient?: import("@tanstack/react-query").QueryClient }).queryClient;
    if (!qc) return;
    qc.prefetchQuery({
      queryKey: ["client-account", params.accountId],
      queryFn: () => getClientAccount({ data: { id: params.accountId } }),
      staleTime: 30_000,
    });
    qc.prefetchQuery({
      queryKey: ["sows-by-client", params.accountId],
      queryFn: () => listSowsByClient({ data: { client_account_id: params.accountId } }),
      staleTime: 30_000,
    });
  },
});

type ContactRef = { id: string; name?: string | null; email?: string | null; phone?: string | null; title?: string | null };
type AccountContact = { id: string; role: string; is_primary: boolean; department: string | null; contact: ContactRef | null };
type DealContact = { id: string; role: string; is_primary: boolean; contact: ContactRef | null };
type Deal = {
  id: string;
  title: string;
  status: string;
  value: number | null;
  currency: string | null;
  stage_id: string | null;
  handed_off_project_id: string | null;
  expected_close_date: string | null;
  description: string | null;
  created_at: string;
  source: string | null;
  deal_contacts: DealContact[] | null;
};
type Stage = { id: string; name: string; color: string | null; stage_type: string };

function AccountPage() {
  const { accountId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname.startsWith(`/app/clients/${accountId}/deal/`)) {
    return <Outlet />;
  }

  return <AccountPageContent accountId={accountId} />;
}

function AccountPageContent({ accountId }: { accountId: string }) {
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  const nav = useNavigate();
  const vocab = useVocabulary();
  const qc = useQueryClient();
  const getFn = useServerFn(getClientAccount);
  const tplFn = useServerFn(listProjectTemplates);
  const startFn = useServerFn(startOnboarding);
  const sowListFn = useServerFn(listSowsByClient);
  const sowCreateFn = useServerFn(createSowForClient);
  const renameFn = useServerFn(renameContainer);
  const sowRenameFn = useServerFn(renameSow);
  const sowDeleteFn = useServerFn(deleteSow);
  const sowDuplicateFn = useServerFn(duplicateSow);
  const healthFn = useServerFn(getClientHealthScore);

  const { data } = useQuery({
    queryKey: ["client-account", accountId],
    queryFn: () => getFn({ data: { id: accountId } }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["project-templates", ws?.id],
    queryFn: () => tplFn({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id,
    staleTime: 5 * 60_000,
  });

  const { data: sows = [] } = useQuery({
    queryKey: ["sows-by-client", accountId],
    queryFn: () => sowListFn({ data: { client_account_id: accountId } }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const { data: health } = useQuery({
    queryKey: ["mc-health", accountId],
    queryFn: () => healthFn({ data: { accountId } }),
    staleTime: 60_000,
    enabled: !!data,
  });

  const pulseFn = useServerFn(getClientPulse);
  const { data: pulse } = useQuery({
    queryKey: ["mc-pulse", accountId],
    queryFn: () => pulseFn({ data: { accountId } }),
    staleTime: 60_000,
    enabled: !!data,
  });

  // Onboarding dialog
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>("__none");
  const [goLive, setGoLive] = useState("");

  // Rename header
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const renameMut = useMutation({
    mutationFn: (n: string) => renameFn({ data: { id: accountId, name: n } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-account", accountId] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      setEditingName(false);
      toast.success("Renamed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Privacy toggle
  const setPrivacyFn = useServerFn(setClientAccountPrivacy);
  const privacyMut = useMutation({
    mutationFn: (is_private: boolean) => setPrivacyFn({ data: { id: accountId, is_private } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-account", accountId] });
      qc.invalidateQueries({ queryKey: ["client-accounts"] });
      toast.success("Privacy updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });



  // SOW — scoped to an opportunity. If no dealId is provided, the server
  // creates a placeholder deal (used by the header "+ SOW" shortcut).
  const [sowOpen, setSowOpen] = useState(false);
  const [sowTitle, setSowTitle] = useState("");
  const [sowDealId, setSowDealId] = useState<string | null>(null);
  const newSowMut = useMutation({
    mutationFn: (vars: { dealId: string | null; title: string }) =>
      sowCreateFn({
        data: {
          client_account_id: accountId,
          deal_id: vars.dealId ?? undefined,
          title: vars.title,
        },
      }),
    onSuccess: (sow) => {
      qc.invalidateQueries({ queryKey: ["sows-by-client", accountId] });
      setSowOpen(false);
      setSowTitle("");
      setSowDealId(null);
      toast.success("SOW created");
      nav({
        to: "/app/clients/$accountId/deal/$dealId",
        params: { accountId, dealId: (sow as { deal_id: string }).deal_id },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const renameSowMut = useMutation({
    mutationFn: (v: { sow_id: string; title: string }) => sowRenameFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sows-by-client", accountId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteSowMut = useMutation({
    mutationFn: (id: string) => sowDeleteFn({ data: { sow_id: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sows-by-client", accountId] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicateSowMut = useMutation({
    mutationFn: (id: string) => sowDuplicateFn({ data: { sow_id: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sows-by-client", accountId] }); toast.success("Duplicated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Project create
  const createProject = useCreateProject();
  const [projOpen, setProjOpen] = useState(false);
  const [projName, setProjName] = useState("");
  const [projTargetEnd, setProjTargetEnd] = useState("");

  // AI generate
  const aiCreateFn = useServerFn(generateArtifact);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const folderId = (data as { folder?: { id: string } | null } | undefined)?.folder?.id ?? null;

  const aiCreateMut = useMutation({
    mutationFn: async () => {
      if (!ws?.id) throw new Error("No workspace");
      const res = await aiCreateFn({
        data: {
          workspace_id: ws.id,
          folder_id: folderId,
          kind: "auto",
          mode: "agentic",
          prompt: aiPrompt.trim(),
        },
      });
      if ("error" in res) throw new Error(res.error);
      const projectIds = res.created.filter((c) => c.kind === "project").map((c) => c.id);
      if (projectIds.length > 0) {
        await supabase
          .from("projects")
          .update({ client_account_id: accountId, is_client_project: isClient } as never)
          .in("id", projectIds);
      }
      return res;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["client-account", accountId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setAiOpen(false);
      setAiPrompt("");
      toast.success(res.summary ?? "Created");
      const firstProj = res.created.find((c) => c.kind === "project");
      if (firstProj) nav({ to: "/app/p/$projectId", params: { projectId: firstProj.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startMut = useMutation({
    mutationFn: () => startFn({
      data: {
        workspace_id: ws!.id,
        client_account_id: accountId,
        name,
        template_id: templateId === "__none" ? null : templateId,
        target_go_live: goLive || null,
      },
    }),
    onSuccess: (onb) => {
      toast.success("Onboarding started");
      setOpen(false);
      nav({ to: "/app/onboarding/$id", params: { id: onb.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="h-24 w-full bg-muted/60 rounded" />
        <div className="h-64 w-full bg-muted/40 rounded" />
      </div>
    );
  }

  const { account, projects, contacts, deals, stages = [], folder } = data as typeof data & {
    contacts: AccountContact[];
    deals: Deal[];
    stages: Stage[];
    folder: { id: string; name: string; division_id: string } | null;
  };

  const kind = (account as { kind?: string }).kind ?? "client";
  const isClient = kind === "client";
  const isPersonal = kind === "personal";
  const isInternal = kind === "internal";

  const headerSubtitle = isPersonal
    ? "Your personal workspace — only you can see what's in here."
    : isInternal
    ? "Workspace-wide bucket for internal projects, ops, and templates."
    : account.legal_name;

  return (
    <div className="p-6 space-y-6">
      <Link to="/app/clients"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> All {vocab.customer.plural.toLowerCase()}</Button></Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-4 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            {isClient && <HealthRing score={health?.score ?? null} breakdown={health ? { delivery: health.delivery, commercial: health.commercial, engagement: health.engagement, documents: health.documents } : undefined} />}
            {isClient && pulse && <EngagementBattery score={Math.round(Number(pulse.engagement_score ?? 0))} breakdown={pulse as unknown as Record<string, unknown>} />}
            <div className="min-w-0">
              {editingName ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); if (nameDraft.trim()) renameMut.mutate(nameDraft.trim()); }}
                  className="flex items-center gap-2"
                >
                  <Input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => setEditingName(false)}
                    onKeyDown={(e) => { if (e.key === "Escape") setEditingName(false); }}
                    className="text-2xl font-semibold h-auto py-1 max-w-md"
                  />
                  <Button type="submit" size="sm" disabled={renameMut.isPending}>Save</Button>
                </form>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-2xl font-semibold">{account.name}</h1>
                  <button
                    onClick={() => { setNameDraft(account.name); setEditingName(true); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {headerSubtitle && <p className="text-sm text-muted-foreground">{headerSubtitle}</p>}
              {isClient && (
                <div className="flex flex-wrap gap-2 mt-2 items-center">
                  <Badge variant="secondary">{account.status}</Badge>
                  <Badge variant="outline">Tier: {account.tier}</Badge>
                  {account.industry && <Badge variant="outline">{account.industry}</Badge>}
                  {(account as { is_private?: boolean }).is_private && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
                      <Lock className="h-3 w-3 mr-1" /> Private
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={privacyMut.isPending}
                    onClick={() =>
                      privacyMut.mutate(!(account as { is_private?: boolean }).is_private)
                    }
                    title={
                      (account as { is_private?: boolean }).is_private
                        ? "Make this client visible to all workspace members"
                        : "Restrict to workspace admins and invited members"
                    }
                  >
                    {(account as { is_private?: boolean }).is_private ? (
                      <><Unlock className="h-3 w-3 mr-1" /> Make public</>
                    ) : (
                      <><Lock className="h-3 w-3 mr-1" /> Make private</>
                    )}
                  </Button>
                </div>
              )}
              {isClient && (
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                  {account.website && (
                    <a href={account.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                      <Globe className="h-3 w-3" /> {account.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {account.billing_email && (
                    <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {account.billing_email}</span>
                  )}
                  {account.first_touch_at && (
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Since {new Date(account.first_touch_at).toLocaleDateString()}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ClientCreateMenu
              clientAccountId={account.id}
              clientName={account.name}
              isClient={isClient}
              folderId={folder?.id ?? null}
              onOpenSowDialog={() => { setSowTitle(`SOW — ${account.name}`); setSowOpen(true); }}
            />
            {isClient && (
              <Button variant="outline" size="sm" onClick={() => { setName(`${account.name} onboarding`); setOpen(true); }}>
                Start onboarding
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { setAiPrompt(`Plan a new ${vocab.engagement.singular.toLowerCase()} for ${account.name}: `); setAiOpen(true); }}>
              <Sparkles className="h-4 w-4 mr-1" /> AI
            </Button>
          </div>
        </div>
      </div>


      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isClient && <TabsTrigger value="pipeline">Pipeline ({deals.length + sows.length})</TabsTrigger>}
          <TabsTrigger value="projects">Projects ({projects.filter((p) => !p.is_archived).length})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {isClient && <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>}
          {isClient && <TabsTrigger value="portal">Portal</TabsTrigger>}
          {isClient && <TabsTrigger value="ai">AI & Artifacts</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab accountId={accountId} accountName={account.name} projects={projects} deals={deals} />
        </TabsContent>

        {isClient && (
          <TabsContent value="pipeline" className="mt-4">
            <PipelineTab
              accountId={accountId}
              folderId={folder?.id ?? null}
              deals={deals}
              stages={stages}
              sows={sows}
              onNewSow={(dealId) => { setSowDealId(dealId); setSowTitle(`SOW — ${account.name}`); setSowOpen(true); }}
              onRenameSow={(id, title) => renameSowMut.mutate({ sow_id: id, title })}
              onDuplicateSow={(id) => duplicateSowMut.mutate(id)}
              onDeleteSow={(id) => deleteSowMut.mutate(id)}
            />
          </TabsContent>
        )}

        <TabsContent value="projects" className="mt-4">
          <ProjectsTab accountId={accountId} projects={projects} onNew={() => { setProjName(""); setProjTargetEnd(""); setProjOpen(true); }} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab accountId={accountId} />
        </TabsContent>

        {isClient && (
          <TabsContent value="contacts" className="mt-4">
            <ContactsTab contacts={contacts} />
          </TabsContent>
        )}

        {isClient && (
          <TabsContent value="portal" className="mt-4">
            <PortalActivityTab accountId={accountId} projects={projects} currentUserId={user?.id ?? ""} />
          </TabsContent>
        )}

        {isClient && (
          <TabsContent value="ai" className="mt-4">
            <AiArtifactsTab accountId={accountId} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
          </TabsContent>
        )}
      </Tabs>

      {/* Onboarding dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Start onboarding</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <Label>Template (optional)</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="No template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No template</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Target go-live (optional)</Label><Input type="date" value={goLive} onChange={(e) => setGoLive(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => startMut.mutate()} disabled={!name || startMut.isPending}>Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SOW dialog */}
      <Dialog open={sowOpen} onOpenChange={setSowOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New SOW for {account.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={sowTitle} onChange={(e) => setSowTitle(e.target.value)} placeholder="Engagement title" /></div>
            <p className="text-xs text-muted-foreground">A placeholder deal is created if this client has none.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSowOpen(false)}>Cancel</Button>
            <Button onClick={() => newSowMut.mutate({ dealId: sowDealId, title: sowTitle })} disabled={!sowTitle.trim() || newSowMut.isPending}>
              {newSowMut.isPending ? "Creating…" : "Create SOW"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project dialog */}
      <Dialog open={projOpen} onOpenChange={setProjOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New {vocab.engagement.singular.toLowerCase()} for {account.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={projName} onChange={(e) => setProjName(e.target.value)} placeholder={`${vocab.engagement.singular} title`} autoFocus />
            </div>
            <div>
              <Label>Target end date (optional)</Label>
              <Input type="date" value={projTargetEnd} onChange={(e) => setProjTargetEnd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjOpen(false)}>Cancel</Button>
            <Button
              disabled={!projName.trim() || createProject.isPending}
              onClick={() => {
                createProject.mutate(
                  {
                    name: projName.trim(),
                    client_account_id: accountId,
                    client_name: isClient ? account.name : null,
                    is_client_project: isClient,
                    target_end_date: projTargetEnd || null,
                    folder_id: folder?.id ?? null,
                  },
                  {
                    onSuccess: (proj) => {
                      qc.invalidateQueries({ queryKey: ["client-account", accountId] });
                      setProjOpen(false);
                      nav({ to: "/app/p/$projectId", params: { projectId: proj.id } });
                    },
                  },
                );
              }}
            >
              {createProject.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" /> Create with AI</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Describe what to create</Label>
              <Textarea
                rows={5}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={`e.g. Q3 brand refresh for ${account.name}: discovery, moodboards, logo system, 4-week timeline.`}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
            <Button disabled={aiPrompt.trim().length < 3 || aiCreateMut.isPending} onClick={() => aiCreateMut.mutate()}>
              {aiCreateMut.isPending ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
