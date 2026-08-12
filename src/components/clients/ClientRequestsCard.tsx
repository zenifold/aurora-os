import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listClientRequestBundles,
  getClientRequestBundle,
  createClientRequestBundle,
  updateClientRequestBundle,
  deleteClientRequestBundle,
  upsertClientRequestItem,
  deleteClientRequestItem,
  generateClientRequestItems,
  summarizeClientRequestSubmission,
  getRequestUploadSignedUrl,
} from "@/lib/client-requests.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Plus,
  Send,
  Link2,
  Trash2,
  ClipboardList,
  FileUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Wand2,
  X,
} from "lucide-react";

type ItemType = "file" | "text" | "decision" | "link";
type BundleStatus = "draft" | "sent" | "partial" | "completed" | "archived";

interface DraftItem {
  id?: string;
  label: string;
  description?: string | null;
  item_type: ItemType;
  is_required: boolean;
}

const STATUS_META: Record<BundleStatus, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  partial: { label: "In progress", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  completed: { label: "Completed", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  archived: { label: "Archived", tone: "bg-muted text-muted-foreground" },
};

const ITEM_TYPE_META: Record<ItemType, { label: string; icon: typeof FileUp }> = {
  file: { label: "File upload", icon: FileUp },
  text: { label: "Written answer", icon: ClipboardList },
  decision: { label: "Decision", icon: CheckCircle2 },
  link: { label: "Link", icon: Link2 },
};

export function ClientRequestsCard({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listClientRequestBundles);
  const { data, isLoading } = useQuery({
    queryKey: ["client-request-bundles", accountId],
    queryFn: () => listFn({ data: { client_account_id: accountId } }),
  });

  const [creatorOpen, setCreatorOpen] = useState(false);
  const [openBundleId, setOpenBundleId] = useState<string | null>(null);

  const bundles = data?.bundles ?? [];

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["client-request-bundles", accountId] });

  return (
    <>
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Requests from client
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send a checklist of files, answers, or decisions you need from {accountName}. They respond async via a shared link.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreatorOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New request
          </Button>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : bundles.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No requests yet. Use AI or create one manually to ask for what you need.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {bundles.map((b) => {
              const items = (b.items as Array<{ status: string; is_required: boolean }> | null) ?? [];
              const submitted = items.filter((i) => i.status === "submitted").length;
              const total = items.length;
              const meta = STATUS_META[b.status as BundleStatus] ?? STATUS_META.draft;
              return (
                <li key={b.id} className="py-3">
                  <button
                    onClick={() => setOpenBundleId(b.id)}
                    className="flex w-full items-start justify-between gap-3 text-left hover:opacity-80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{b.title}</span>
                        <Badge className={meta.tone}>{meta.label}</Badge>
                        {b.due_date && (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Due {new Date(b.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {submitted}/{total} items submitted
                        {b.recipient_email ? ` · ${b.recipient_email}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {creatorOpen && (
        <BundleCreatorDialog
          accountId={accountId}
          accountName={accountName}
          open={creatorOpen}
          onClose={() => setCreatorOpen(false)}
          onCreated={(id) => {
            setCreatorOpen(false);
            refresh();
            setOpenBundleId(id);
          }}
        />
      )}

      {openBundleId && (
        <BundleDetailDialog
          bundleId={openBundleId}
          open
          onClose={() => {
            setOpenBundleId(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

/* ===================== Creator ===================== */
function BundleCreatorDialog({
  accountId,
  accountName,
  open,
  onClose,
  onCreated,
}: {
  accountId: string;
  accountName: string;
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const generateFn = useServerFn(generateClientRequestItems);
  const createFn = useServerFn(createClientRequestBundle);

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [aiPrompt, setAiPrompt] = useState("");
  const [title, setTitle] = useState(`Items needed from ${accountName}`);
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [items, setItems] = useState<DraftItem[]>([
    { label: "", description: "", item_type: "file", is_required: true },
  ]);

  const genMut = useMutation({
    mutationFn: () => generateFn({ data: { client_account_id: accountId, prompt: aiPrompt } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.draft.title) setTitle(res.draft.title);
      if (res.draft.instructions) setInstructions(res.draft.instructions);
      if (res.draft.items && res.draft.items.length) {
        setItems(
          res.draft.items.map((i) => ({
            label: i.label,
            description: i.description ?? "",
            item_type: (i.item_type ?? "file") as ItemType,
            is_required: i.is_required ?? true,
          })),
        );
      }
      setMode("manual");
      toast.success("Draft generated — review and send");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          client_account_id: accountId,
          title,
          instructions: instructions || null,
          due_date: dueDate || null,
          recipient_name: recipientName || null,
          recipient_email: recipientEmail || null,
          items: items
            .filter((i) => i.label.trim())
            .map((i) => ({
              label: i.label.trim(),
              description: i.description || null,
              item_type: i.item_type,
              is_required: i.is_required,
            })),
        },
      }),
    onSuccess: (res) => {
      toast.success("Request created");
      onCreated(res.bundle.id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New request from {accountName}</DialogTitle>
          <DialogDescription>
            Outline exactly what you need. The client opens a shared link, uploads files or types answers, and submits async.
          </DialogDescription>
        </DialogHeader>

        {mode === "ai" && (
          <div className="space-y-3">
            <Label>Describe what you need</Label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. Everything needed to kick off a brand refresh: brand guidelines, hi-res logos, font files, sample marketing materials, decision on color direction…"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setMode("manual")}
                className="gap-1.5"
              >
                Skip — build manually
              </Button>
              <Button
                onClick={() => genMut.mutate()}
                disabled={!aiPrompt.trim() || genMut.isPending}
                className="gap-1.5 flex-1"
              >
                <Wand2 className="h-3.5 w-3.5" />
                {genMut.isPending ? "Generating…" : "Generate checklist with AI"}
              </Button>
            </div>
          </div>
        )}

        {mode === "manual" && (
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Intro for client (optional)</Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Recipient name</Label>
                <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
              </div>
              <div>
                <Label>Recipient email</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items requested</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      { label: "", description: "", item_type: "file", is_required: true },
                    ])
                  }
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" /> Add item
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="rounded border border-border p-3 space-y-2 bg-card/50">
                    <div className="flex gap-2">
                      <Input
                        value={it.label}
                        placeholder="What do you need? e.g. Hi-res logo files"
                        onChange={(e) => updateItem(idx, { label: e.target.value })}
                        className="flex-1"
                      />
                      <Select
                        value={it.item_type}
                        onValueChange={(v) => updateItem(idx, { item_type: v as ItemType })}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ITEM_TYPE_META) as ItemType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {ITEM_TYPE_META[t].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={it.description ?? ""}
                      placeholder="Guidance for the client (optional)"
                      rows={1}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={it.is_required}
                        onCheckedChange={(v) => updateItem(idx, { is_required: !!v })}
                      />
                      Required
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {mode === "manual" && (
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !title || items.every((i) => !i.label.trim())}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Create request
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== Detail / share / responses ===================== */
function BundleDetailDialog({
  bundleId,
  open,
  onClose,
}: {
  bundleId: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getClientRequestBundle);
  const updateFn = useServerFn(updateClientRequestBundle);
  const deleteFn = useServerFn(deleteClientRequestBundle);
  const upsertItemFn = useServerFn(upsertClientRequestItem);
  const deleteItemFn = useServerFn(deleteClientRequestItem);
  const summarizeFn = useServerFn(summarizeClientRequestSubmission);
  const signFn = useServerFn(getRequestUploadSignedUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["client-request-bundle", bundleId],
    queryFn: () => getFn({ data: { bundle_id: bundleId } }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["client-request-bundle", bundleId] });
  };

  const sendMut = useMutation({
    mutationFn: () => updateFn({ data: { bundle_id: bundleId, status: "sent" } }),
    onSuccess: () => {
      toast.success("Marked as sent");
      refresh();
    },
  });
  const archiveMut = useMutation({
    mutationFn: () => updateFn({ data: { bundle_id: bundleId, status: "archived" } }),
    onSuccess: () => {
      toast.success("Archived");
      onClose();
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { bundle_id: bundleId } }),
    onSuccess: () => {
      toast.success("Deleted");
      onClose();
    },
  });
  const summarizeMut = useMutation({
    mutationFn: () => summarizeFn({ data: { bundle_id: bundleId } }),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("AI summary updated");
        refresh();
      }
    },
  });

  const bundle = data?.bundle;
  const items = data?.items ?? [];
  const submitted = items.filter((i) => i.status === "submitted").length;
  const shareUrl =
    bundle && typeof window !== "undefined"
      ? `${window.location.origin}/r/${bundle.share_token}`
      : "";

  const aiSummary = (() => {
    if (!bundle?.ai_summary) return null;
    try {
      return JSON.parse(bundle.ai_summary) as {
        summary?: string;
        gaps?: string[];
        plan_updates?: string[];
        next_actions?: string[];
      };
    } catch {
      return null;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {isLoading || !bundle ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {bundle.title}
                <Badge className={STATUS_META[bundle.status as BundleStatus].tone}>
                  {STATUS_META[bundle.status as BundleStatus].label}
                </Badge>
              </DialogTitle>
              {bundle.instructions && (
                <DialogDescription>{bundle.instructions}</DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4">
              {/* Share link */}
              <Card className="p-3 space-y-2">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">
                  Share with client
                </Label>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success("Link copied");
                    }}
                    className="gap-1"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Copy
                  </Button>
                  {bundle.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => sendMut.mutate()}
                      disabled={sendMut.isPending}
                      className="gap-1"
                    >
                      <Send className="h-3.5 w-3.5" /> Mark sent
                    </Button>
                  )}
                </div>
              </Card>

              {/* Items + responses */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">
                    Items ({submitted}/{items.length} submitted)
                  </h4>
                </div>
                <div className="space-y-2">
                  {items.map((it) => {
                    const Icon = ITEM_TYPE_META[(it.item_type ?? "file") as ItemType].icon;
                    const files = (it.response_files as Array<{ path: string; name: string }> | null) ?? [];
                    return (
                      <div
                        key={it.id}
                        className="rounded border border-border p-3 bg-card/50 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{it.label}</span>
                                {!it.is_required && (
                                  <Badge variant="outline" className="text-xs">Optional</Badge>
                                )}
                                {it.status === "submitted" ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Submitted
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs">
                                    <Clock className="h-3 w-3 mr-1" /> Pending
                                  </Badge>
                                )}
                              </div>
                              {it.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {it.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              await deleteItemFn({
                                data: { bundle_id: bundleId, item_id: it.id },
                              });
                              refresh();
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {it.status === "submitted" && (
                          <div className="border-l-2 border-emerald-500/30 pl-3 ml-6 space-y-1">
                            {it.response_text && (
                              <p className="text-sm whitespace-pre-wrap">{it.response_text}</p>
                            )}
                            {it.response_decision && (
                              <p className="text-sm">
                                <span className="text-muted-foreground">Decision:</span>{" "}
                                <strong>{it.response_decision}</strong>
                              </p>
                            )}
                            {it.response_link && (
                              <a
                                href={it.response_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary underline"
                              >
                                {it.response_link}
                              </a>
                            )}
                            {files.map((f) => (
                              <button
                                key={f.path}
                                onClick={async () => {
                                  try {
                                    const { url } = await signFn({
                                      data: { bundle_id: bundleId, path: f.path },
                                    });
                                    window.open(url, "_blank", "noopener");
                                  } catch (e) {
                                    toast.error((e as Error).message);
                                  }
                                }}
                                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                              >
                                <Download className="h-3.5 w-3.5" /> {f.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <AddItemInline
                  onAdd={async (item) => {
                    await upsertItemFn({
                      data: {
                        bundle_id: bundleId,
                        label: item.label,
                        description: item.description ?? null,
                        item_type: item.item_type,
                        is_required: item.is_required,
                        sort_order: items.length,
                      },
                    });
                    refresh();
                  }}
                />
              </div>

              {/* AI summary */}
              {submitted > 0 && (
                <Card className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> AI summary &amp; plan updates
                    </Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => summarizeMut.mutate()}
                      disabled={summarizeMut.isPending}
                      className="gap-1"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      {aiSummary ? "Re-analyze" : "Analyze submission"}
                    </Button>
                  </div>
                  {aiSummary && (
                    <div className="text-sm space-y-2">
                      {aiSummary.summary && <p>{aiSummary.summary}</p>}
                      {aiSummary.gaps?.length ? (
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Gaps
                          </p>
                          <ul className="list-disc pl-5 text-sm space-y-0.5">
                            {aiSummary.gaps.map((g, i) => <li key={i}>{g}</li>)}
                          </ul>
                        </div>
                      ) : null}
                      {aiSummary.plan_updates?.length ? (
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wider mb-1">
                            Suggested plan updates
                          </p>
                          <ul className="list-disc pl-5 text-sm space-y-0.5">
                            {aiSummary.plan_updates.map((g, i) => <li key={i}>{g}</li>)}
                          </ul>
                        </div>
                      ) : null}
                      {aiSummary.next_actions?.length ? (
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wider mb-1">
                            Next actions
                          </p>
                          <ul className="list-disc pl-5 text-sm space-y-0.5">
                            {aiSummary.next_actions.map((g, i) => <li key={i}>{g}</li>)}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}
                </Card>
              )}
            </div>

            <DialogFooter className="gap-2">
              {bundle.status !== "archived" && (
                <Button variant="outline" onClick={() => archiveMut.mutate()}>
                  Archive
                </Button>
              )}
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  if (confirm("Delete this request and all responses?")) deleteMut.mutate();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddItemInline({ onAdd }: { onAdd: (item: DraftItem) => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ItemType>("file");
  return (
    <div className="flex gap-2 mt-2">
      <Input
        placeholder="Add another item…"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <Select value={type} onValueChange={(v) => setType(v as ItemType)}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(ITEM_TYPE_META) as ItemType[]).map((t) => (
            <SelectItem key={t} value={t}>{ITEM_TYPE_META[t].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={!label.trim()}
        onClick={async () => {
          await onAdd({ label: label.trim(), item_type: type, is_required: true });
          setLabel("");
        }}
      >
        Add
      </Button>
    </div>
  );
}
