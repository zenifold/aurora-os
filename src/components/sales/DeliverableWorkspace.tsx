import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sparkles,
  RefreshCw,
  GitBranch,
  Clock,
  MessageSquare,
  History,
  FileText,
  CheckCircle2,
  AlertCircle,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { getKindDef, type SectionDef } from "@/lib/deliverable-kinds";
import {
  useDeliverable,
  useUpdateDeliverableSection,
  useGenerateDeliverable,
  useRegenerateDeliverableSection,
  useForkVersion,
  useRestoreVersion,
  useSetDeliverableStatus,
  useDeliverableComments,
  useAddDeliverableComment,
  useResolveComment,
  useAgentRuns,
  useCreateShareLink,
} from "@/hooks/use-deliverables";

type DeliverableRecord = {
  id: string;
  kind: string;
  title: string;
  status: string;
  current_version_id: string | null;
  deal_id: string;
};

type VersionRecord = {
  id: string;
  version: number;
  status: string;
  sections: Record<string, { content?: unknown; ai_generated_at?: string }>;
  citations: Record<string, Array<{ document_id: string; snippet: string }>>;
  diff_against_prev: Record<string, "added" | "changed" | "unchanged">;
  ai_model: string | null;
  ai_generated_at: string | null;
  change_summary: string | null;
  created_at: string;
};

const STATUS_OPTS = [
  "draft",
  "internal_review",
  "customer_review",
  "approved",
  "signed",
  "superseded",
];

function stringifyContent(c: unknown): string {
  if (c == null) return "";
  if (typeof c === "string") return c;
  try {
    return JSON.stringify(c, null, 2);
  } catch {
    return String(c);
  }
}

function SectionEditor({
  section,
  value,
  citations,
  diff,
  aiGeneratedAt,
  onSave,
  onRegenerate,
  isRegenerating,
}: {
  section: SectionDef;
  value: unknown;
  citations: Array<{ document_id: string; snippet: string }> | undefined;
  diff: "added" | "changed" | "unchanged" | undefined;
  aiGeneratedAt: string | undefined;
  onSave: (content: unknown) => void;
  onRegenerate: (instruction?: string) => void;
  isRegenerating: boolean;
}) {
  const [draft, setDraft] = useState<string>(stringifyContent(value));
  const [instruction, setInstruction] = useState("");
  const isText = section.kind === "text";
  const dirty = stringifyContent(value) !== draft;

  return (
    <div id={`section-${section.key}`} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{section.label}</h3>
            {section.required && (
              <Badge variant="outline" className="text-[10px]">
                required
              </Badge>
            )}
            {diff === "added" && (
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600">new</Badge>
            )}
            {diff === "changed" && (
              <Badge className="text-[10px] bg-amber-500/10 text-amber-600">changed</Badge>
            )}
          </div>
          {aiGeneratedAt && (
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Sparkles className="h-3 w-3" />
              AI {new Date(aiGeneratedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="font-mono text-xs min-h-[140px]"
        placeholder={`(${isText ? "markdown" : "JSON"})`}
      />

      {!!citations?.length && (
        <div className="flex flex-wrap gap-1.5">
          {citations.map((c, i) => (
            <Badge key={i} variant="outline" className="text-[10px] font-normal" title={c.snippet}>
              📎 {c.snippet.slice(0, 60)}
              {c.snippet.length > 60 ? "…" : ""}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional: instruct the AI (e.g. 'shorter, more technical')"
          className="text-xs h-8"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onRegenerate(instruction || undefined);
            setInstruction("");
          }}
          disabled={isRegenerating}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRegenerating ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
        <Button
          size="sm"
          disabled={!dirty}
          onClick={() => {
            let parsed: unknown = draft;
            if (!isText) {
              try {
                parsed = draft ? JSON.parse(draft) : null;
              } catch {
                toast.error("Section value must be valid JSON");
                return;
              }
            }
            onSave(parsed);
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function CommentsPanel({ deliverableId }: { deliverableId: string }) {
  const { data: comments } = useDeliverableComments(deliverableId);
  const add = useAddDeliverableComment(deliverableId);
  const resolve = useResolveComment(deliverableId);
  const [body, setBody] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {!comments?.length && (
          <div className="text-xs text-muted-foreground text-center py-6">No comments yet.</div>
        )}
        {comments?.map((c) => (
          <div
            key={c.id}
            className={`rounded border border-border p-2 text-xs ${
              c.resolved ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">
                {c.section_key ? `§ ${c.section_key}` : "General"}
              </span>
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => resolve.mutate({ comment_id: c.id, resolved: !c.resolved })}
              >
                {c.resolved ? "Reopen" : "Resolve"}
              </button>
            </div>
            <div className="whitespace-pre-wrap">{c.body}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {new Date(c.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-border pt-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          className="text-xs min-h-[60px]"
        />
        <Button
          size="sm"
          disabled={!body.trim()}
          onClick={async () => {
            await add.mutateAsync({ body });
            setBody("");
          }}
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1" />
          Comment
        </Button>
      </div>
    </div>
  );
}

function VersionsPanel({
  versions,
  currentVersionId,
  onSelect,
}: {
  versions: Array<{
    id: string;
    version: number;
    label: string | null;
    status: string;
    ai_generated_at: string | null;
    change_summary: string | null;
    created_at: string;
  }>;
  currentVersionId: string | null;
  onSelect: (id: string) => void;
}) {
  const restore = useRestoreVersion();
  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div
          key={v.id}
          className={`rounded border p-2 text-xs ${
            v.id === currentVersionId ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <button onClick={() => onSelect(v.id)} className="font-medium hover:underline">
              v{v.version} {v.label ? `· ${v.label}` : ""}
            </button>
            <Badge variant="outline" className="text-[10px]">
              {v.status}
            </Badge>
          </div>
          {v.change_summary && (
            <div className="text-muted-foreground mt-1 line-clamp-2">{v.change_summary}</div>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">
              {new Date(v.created_at).toLocaleString()}
            </span>
            {v.id !== currentVersionId && (
              <button
                className="text-[10px] text-primary hover:underline"
                onClick={() => restore.mutate(v.id)}
              >
                Restore
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityPanel({ deliverableId }: { deliverableId: string }) {
  const { data: runs } = useAgentRuns(deliverableId);
  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      {!runs?.length && (
        <div className="text-xs text-muted-foreground text-center py-6">No AI runs yet.</div>
      )}
      {runs?.map((r) => (
        <div key={r.id} className="rounded border border-border p-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-1">
              {r.status === "succeeded" ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-destructive" />
              )}
              {r.section_key ?? "full document"}
            </span>
            <span className="text-[10px] text-muted-foreground">{r.model ?? "—"}</span>
          </div>
          {r.error && <div className="text-destructive mt-1 text-[10px]">{r.error}</div>}
          <div className="text-[10px] text-muted-foreground mt-1">
            {r.input_tokens != null && `${r.input_tokens}↑/${r.output_tokens}↓ tok · `}
            {new Date(r.created_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShareDialog({ deliverableId }: { deliverableId: string }) {
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<"read" | "comment">("read");
  const [link, setLink] = useState<string | null>(null);
  const create = useCreateShareLink(deliverableId);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="h-3.5 w-3.5 mr-1" />
        Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share with customer</DialogTitle>
            <DialogDescription>
              Generate a tokenized link. Customer doesn't need an account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={access} onValueChange={(v) => setAccess(v as "read" | "comment")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read only</SelectItem>
                <SelectItem value="comment">Read + comment</SelectItem>
              </SelectContent>
            </Select>
            {link && (
              <div className="rounded bg-muted p-2 text-xs font-mono break-all">{link}</div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                const res = (await create.mutateAsync({ access })) as { token: string };
                setLink(`${window.location.origin}/share/${res.token}`);
              }}
              disabled={create.isPending}
            >
              {create.isPending ? "Creating…" : "Create link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeliverableWorkspace({
  deliverableId,
  open,
  onOpenChange,
}: {
  deliverableId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [viewVersionId, setViewVersionId] = useState<string | undefined>(undefined);
  const { data, isLoading } = useDeliverable(deliverableId, viewVersionId);
  const update = useUpdateDeliverableSection();
  const generate = useGenerateDeliverable(deliverableId);
  const regen = useRegenerateDeliverableSection(deliverableId);
  const fork = useForkVersion();
  const setStatus = useSetDeliverableStatus(
    (data?.deliverable as DeliverableRecord | undefined)?.deal_id ?? "",
  );

  const del = data?.deliverable as DeliverableRecord | undefined;
  const version = data?.version as VersionRecord | null | undefined;
  const versions = (data?.versions ?? []) as Array<{
    id: string;
    version: number;
    label: string | null;
    status: string;
    ai_generated_at: string | null;
    change_summary: string | null;
    created_at: string;
  }>;

  const kindDef = useMemo(() => (del ? getKindDef(del.kind) : null), [del]);
  const isLocked = version?.status !== "draft";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
        {isLoading || !del || !kindDef ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <DialogHeader className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="truncate">{del.title}</DialogTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {kindDef.label}
                    </Badge>
                    {version && (
                      <Badge variant="outline" className="text-[10px]">
                        v{version.version}
                      </Badge>
                    )}
                  </div>
                  {version?.change_summary && (
                    <DialogDescription className="line-clamp-1 mt-1">
                      {version.change_summary}
                    </DialogDescription>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Select
                    value={del.status}
                    onValueChange={(v) =>
                      setStatus.mutate({ deliverable_id: del.id, status: v })
                    }
                  >
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTS.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isLocked && version && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fork.mutate({ version_id: version.id })}
                    >
                      <GitBranch className="h-3.5 w-3.5 mr-1" />
                      Fork to draft
                    </Button>
                  )}
                  <ShareDialog deliverableId={del.id} />
                  <Button
                    size="sm"
                    onClick={() => generate.mutate({})}
                    disabled={generate.isPending}
                  >
                    <Sparkles className={`h-3.5 w-3.5 mr-1 ${generate.isPending ? "animate-pulse" : ""}`} />
                    {version ? "Regenerate all" : "Draft with AI"}
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 flex min-h-0">
              {/* LEFT: TOC */}
              <div className="w-56 border-r border-border bg-muted/30 p-3 overflow-y-auto flex-shrink-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-medium">
                  Sections
                </div>
                <nav className="space-y-0.5">
                  {kindDef.sections.map((s) => {
                    const diff = version?.diff_against_prev?.[s.key];
                    const has = !!version?.sections?.[s.key]?.content;
                    return (
                      <a
                        key={s.key}
                        href={`#section-${s.key}`}
                        className="block text-xs px-2 py-1.5 rounded hover:bg-accent flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{s.label}</span>
                        <span className="flex items-center gap-1">
                          {diff === "added" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                          {diff === "changed" && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                          {has && diff === "unchanged" && (
                            <CheckCircle2 className="h-3 w-3 text-muted-foreground/50" />
                          )}
                        </span>
                      </a>
                    );
                  })}
                </nav>
              </div>

              {/* CENTER: Editor */}
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  {isLocked && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                      This version is <strong>{version?.status.replace(/_/g, " ")}</strong> and
                      locked. Fork a draft to edit.
                    </div>
                  )}
                  {!version && (
                    <div className="rounded-md border border-dashed border-border p-8 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                      <div className="text-sm font-medium">No version yet</div>
                      <div className="text-xs text-muted-foreground mb-3">
                        Use "Draft with AI" to synthesize from your discovery brief and documents.
                      </div>
                    </div>
                  )}
                  {version &&
                    kindDef.sections.map((s) => {
                      const sec = version.sections?.[s.key] ?? {};
                      return (
                        <SectionEditor
                          key={s.key}
                          section={s}
                          value={(sec as { content?: unknown }).content}
                          citations={version.citations?.[s.key]}
                          diff={version.diff_against_prev?.[s.key]}
                          aiGeneratedAt={(sec as { ai_generated_at?: string }).ai_generated_at}
                          isRegenerating={regen.isPending}
                          onSave={(content) =>
                            !isLocked &&
                            update.mutate({
                              version_id: version.id,
                              section_key: s.key,
                              content,
                            })
                          }
                          onRegenerate={(instruction) =>
                            !isLocked &&
                            regen.mutate({
                              version_id: version.id,
                              section_key: s.key,
                              instruction,
                            })
                          }
                        />
                      );
                    })}
                </div>
              </ScrollArea>

              {/* RIGHT: Tabs */}
              <div className="w-80 border-l border-border flex flex-col flex-shrink-0">
                <Tabs defaultValue="versions" className="flex-1 flex flex-col">
                  <TabsList className="w-full justify-start rounded-none border-b border-border h-9 px-2">
                    <TabsTrigger value="versions" className="text-xs h-7">
                      <History className="h-3 w-3 mr-1" />
                      Versions
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="text-xs h-7">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Comments
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs h-7">
                      <Clock className="h-3 w-3 mr-1" />
                      Activity
                    </TabsTrigger>
                  </TabsList>
                  <ScrollArea className="flex-1">
                    <TabsContent value="versions" className="p-3 mt-0">
                      <VersionsPanel
                        versions={versions}
                        currentVersionId={version?.id ?? null}
                        onSelect={setViewVersionId}
                      />
                    </TabsContent>
                    <TabsContent value="comments" className="p-3 mt-0">
                      <CommentsPanel deliverableId={del.id} />
                    </TabsContent>
                    <TabsContent value="activity" className="p-3 mt-0">
                      <ActivityPanel deliverableId={del.id} />
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
