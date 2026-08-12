import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles,
  Edit3,
  Check,
  X,
  RefreshCw,
  FileText,
  Lightbulb,
  Plus,
  ExternalLink,
} from "lucide-react";
import {
  generateArtifact,
  editArtifact,
  applyArtifact,
  discardArtifact,
  getDraftsInbox,
  getAppliedArtifacts,
  getAiInsights,
} from "@/lib/ai-artifacts.functions";

const ARTIFACT_KINDS = [
  { value: "sow", label: "SOW" },
  { value: "project_plan", label: "Project plan" },
  { value: "meeting_summary", label: "Meeting summary" },
  { value: "risk_assessment", label: "Risk assessment" },
  { value: "email_draft", label: "Email draft" },
  { value: "proposal", label: "Proposal" },
  { value: "status_report", label: "Status report" },
  { value: "phase_kickoff", label: "Phase kickoff" },
];

type Draft = {
  id: string;
  kind: string;
  title: string;
  status: string;
  created_at: string;
  project_id: string | null;
  deal_id: string | null;
  content_raw: string | null;
  content_edited: string | null;
  model_version: string | null;
  trigger_source: string;
  version_number: number;
};

function GenerateDialog({
  accountId,
  projects,
  onCreated,
}: {
  accountId: string;
  projects: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("status_report");
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [instruction, setInstruction] = useState("");
  const generateFn = useServerFn(generateArtifact);

  const mut = useMutation({
    mutationFn: () =>
      generateFn({
        data: {
          accountId,
          kind: kind as never,
          title: title || `${ARTIFACT_KINDS.find((k) => k.value === kind)?.label ?? "Artifact"} — ${new Date().toLocaleDateString()}`,
          projectId: projectId === "none" ? null : projectId,
          userInstruction: instruction || undefined,
          triggerSource: "manual",
        },
      }),
    onSuccess: () => {
      toast.success("Draft generated");
      setOpen(false);
      setTitle("");
      setInstruction("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Generate artifact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate AI artifact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Type</label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ARTIFACT_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Title (optional)</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Auto-generated if blank" />
          </div>
          <div>
            <label className="text-xs font-medium">Project (optional)</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Extra instructions (optional)</label>
            <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3} placeholder="Emphasize compliance, reference past project, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraftCard({
  draft,
  accountId,
  onChanged,
}: {
  draft: Draft;
  accountId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.content_edited ?? draft.content_raw ?? "");
  const editFn = useServerFn(editArtifact);
  const applyFn = useServerFn(applyArtifact);
  const discardFn = useServerFn(discardArtifact);
  const regenFn = useServerFn(generateArtifact);

  const saveMut = useMutation({
    mutationFn: () => editFn({ data: { artifactId: draft.id, contentEdited: body } }),
    onSuccess: () => { toast.success("Saved"); setEditing(false); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyMut = useMutation({
    mutationFn: () => applyFn({ data: { artifactId: draft.id } }),
    onSuccess: () => { toast.success("Applied"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const discardMut = useMutation({
    mutationFn: () => discardFn({ data: { artifactId: draft.id } }),
    onSuccess: () => { toast.success("Discarded"); onChanged(); },
  });

  const regenMut = useMutation({
    mutationFn: () =>
      regenFn({
        data: {
          accountId,
          kind: draft.kind as never,
          title: `${draft.title} (regenerated)`,
          projectId: draft.project_id,
          dealId: draft.deal_id,
          triggerSource: "manual",
          parentArtifactId: draft.id,
        },
      }),
    onSuccess: () => { toast.success("New draft generated"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium">{draft.title}</span>
            <Badge variant="outline" className="text-[10px] capitalize">{draft.kind.replace(/_/g, " ")}</Badge>
            <Badge variant="secondary" className="text-[10px] capitalize">{draft.status}</Badge>
            {draft.version_number > 1 && (
              <Badge variant="outline" className="text-[10px]">v{draft.version_number}</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Generated {new Date(draft.created_at).toLocaleString()} · {draft.model_version ?? "—"} · {draft.trigger_source}
          </p>
        </div>
      </div>

      {editing ? (
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="text-xs font-mono" />
      ) : (
        <pre className="text-xs whitespace-pre-wrap line-clamp-6 bg-muted/30 rounded p-2 max-h-48 overflow-auto">
          {body || "(empty)"}
        </pre>
      )}

      <div className="flex gap-2 flex-wrap">
        {editing ? (
          <>
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Check className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setBody(draft.content_edited ?? draft.content_raw ?? ""); }}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            <Button size="sm" onClick={() => applyMut.mutate()} disabled={applyMut.isPending}>
              <Check className="h-3.5 w-3.5 mr-1" /> Edit & apply
            </Button>
            <Button size="sm" variant="outline" onClick={() => regenMut.mutate()} disabled={regenMut.isPending}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => discardMut.mutate()}>
              <X className="h-3.5 w-3.5 mr-1" /> Discard
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

export function AiArtifactsTab({
  accountId,
  projects,
}: {
  accountId: string;
  projects: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const draftsFn = useServerFn(getDraftsInbox);
  const appliedFn = useServerFn(getAppliedArtifacts);
  const insightsFn = useServerFn(getAiInsights);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ai-drafts", accountId] });
    qc.invalidateQueries({ queryKey: ["ai-applied", accountId] });
    qc.invalidateQueries({ queryKey: ["ai-insights", accountId] });
  };

  const { data: drafts = [] } = useQuery({
    queryKey: ["ai-drafts", accountId],
    queryFn: () => draftsFn({ data: { accountId } }),
    staleTime: 15_000,
  });
  const { data: applied = [] } = useQuery({
    queryKey: ["ai-applied", accountId],
    queryFn: () => appliedFn({ data: { accountId } }),
    staleTime: 30_000,
  });
  const { data: insights = [] } = useQuery({
    queryKey: ["ai-insights", accountId],
    queryFn: () => insightsFn({ data: { accountId } }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> AI & Artifacts
          </h2>
          <p className="text-xs text-muted-foreground">Drafts inbox — review, edit, apply.</p>
        </div>
        <GenerateDialog accountId={accountId} projects={projects} onCreated={refresh} />
      </div>

      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts">
            Needs review {drafts.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{drafts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="applied">Recently applied</TabsTrigger>
          <TabsTrigger value="insights">AI insights</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="space-y-2 mt-4">
          {drafts.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground text-center">
              No drafts to review. Generate one to get started.
            </Card>
          ) : (
            (drafts as Draft[]).map((d) => (
              <DraftCard key={d.id} draft={d} accountId={accountId} onChanged={refresh} />
            ))
          )}
        </TabsContent>

        <TabsContent value="applied" className="space-y-2 mt-4">
          {applied.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground text-center">Nothing applied yet.</Card>
          ) : (
            applied.map((a) => (
              <Card key={a.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="capitalize">{a.kind.replace(/_/g, " ")}</span> →{" "}
                      {a.applied_to_type ?? "—"} ·{" "}
                      {a.applied_at ? new Date(a.applied_at).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
                {a.applied_to_id && (
                  <Button size="sm" variant="ghost" className="h-7">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-2 mt-4">
          {insights.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground text-center">No insights yet.</Card>
          ) : (
            insights.map((i) => (
              <Card key={i.id} className="p-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{i.content_raw}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {new Date(i.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
