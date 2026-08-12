import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FileSignature,
  FileText,
  Search,
  Layers,
  TrendingUp,
  ClipboardCheck,
  DollarSign,
  Shield,
  ListChecks,
  Presentation,
  Play,
  MoreHorizontal,
  Trash2,
  Sparkles,
  Clock,
  Settings2,
  Wand2,
} from "lucide-react";
import { DELIVERABLE_KINDS, type DeliverableKindDef } from "@/lib/deliverable-kinds";
import {
  useDeliverables,
  useCreateDeliverable,
  useDeleteDeliverable,
  type DeliverableRow,
} from "@/hooks/use-deliverables";
import { useDeliverableTemplates, type TemplateRow } from "@/hooks/use-deliverable-templates";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { DeliverableWorkspace } from "./DeliverableWorkspace";
import { TemplateManagerDialog } from "./TemplateManagerDialog";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "file-signature": FileSignature,
  "file-text": FileText,
  search: Search,
  layers: Layers,
  "trending-up": TrendingUp,
  "clipboard-check": ClipboardCheck,
  "dollar-sign": DollarSign,
  shield: Shield,
  "list-checks": ListChecks,
  presentation: Presentation,
  play: Play,
};

function KindIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? FileText;
  return <Cmp className={className} />;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  internal_review: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  customer_review: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  signed: "bg-emerald-600 text-white",
  superseded: "bg-muted text-muted-foreground line-through",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[status] ?? ""}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function DeliverableCard({
  row,
  onDelete,
  onOpen,
}: {
  row: DeliverableRow;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="group relative rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2">
          <KindIcon name={row.kind_icon} className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-sm font-medium truncate">{row.title}</div>
            {row.current_version !== null && (
              <span className="text-xs text-muted-foreground">v{row.current_version}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mb-2">{row.kind_label}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={row.status} />
            {row.ai_generated_at && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI {new Date(row.ai_generated_at).toLocaleDateString()}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(row.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

type Selection =
  | { type: "builtin"; def: DeliverableKindDef }
  | { type: "template"; tpl: TemplateRow };

function CreateDeliverableDialog({
  dealId,
  workspaceId,
  open,
  onOpenChange,
  onManageTemplates,
}: {
  dealId: string;
  workspaceId: string | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onManageTemplates: () => void;
}) {
  const create = useCreateDeliverable(dealId);
  const { data: templates } = useDeliverableTemplates(workspaceId);
  const [selected, setSelected] = useState<Selection | null>(null);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create pre-sales deliverable</DialogTitle>
          <DialogDescription>
            Pick a template. The agent uses your discovery brief + uploaded documents as evidence.
          </DialogDescription>
        </DialogHeader>

        {!!templates?.length && (
          <>
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Custom templates
              </div>
              <Button variant="ghost" size="sm" onClick={onManageTemplates}>
                <Settings2 className="h-3.5 w-3.5 mr-1" /> Manage
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              {templates.map((t) => {
                const isSelected = selected?.type === "template" && selected.tpl.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected({ type: "template", tpl: t })}
                    className={`text-left rounded-lg border p-3 hover:border-primary/40 transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-primary/10 p-2">
                        <Wand2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium truncate">{t.name}</div>
                          <Badge variant="outline" className="text-[10px]">{t.kind}</Badge>
                        </div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {t.schema?.sections?.length ?? 0} sections
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Built-in templates
          </div>
          {!templates?.length && (
            <Button variant="ghost" size="sm" onClick={onManageTemplates}>
              <Settings2 className="h-3.5 w-3.5 mr-1" /> Custom templates
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {DELIVERABLE_KINDS.map((k) => {
            const isSelected = selected?.type === "builtin" && selected.def.kind === k.kind;
            return (
              <button
                key={k.kind}
                onClick={() => setSelected({ type: "builtin", def: k })}
                className={`text-left rounded-lg border p-3 hover:border-primary/40 transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <KindIcon name={k.icon} className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{k.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{k.description}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {k.sections.length} sections
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected || create.isPending}
            onClick={async () => {
              if (!selected) return;
              if (selected.type === "builtin") {
                await create.mutateAsync({ kind: selected.def.kind });
              } else {
                await create.mutateAsync({
                  kind: selected.tpl.kind,
                  template_id: selected.tpl.id,
                  title: selected.tpl.name,
                });
              }
              setSelected(null);
              onOpenChange(false);
            }}
          >
            {create.isPending ? "Creating…" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeliverablesHub({ dealId }: { dealId: string }) {
  const { data: rows, isLoading } = useDeliverables(dealId);
  const del = useDeleteDeliverable(dealId);
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  const [createOpen, setCreateOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Pre-sales deliverables
          </div>
          <div className="text-xs text-muted-foreground">
            All AI-drafted artifacts for this deal — versioned and review-ready.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" />
            Templates
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New deliverable
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground p-6 text-center">Loading…</div>
      ) : !rows?.length ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <div className="text-sm font-medium">No deliverables yet</div>
          <div className="text-xs text-muted-foreground mb-3">
            Spin up a proposal, SOW, business case, RFP response, or your own custom template.
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create first deliverable
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>
              <Wand2 className="h-4 w-4 mr-1" />
              Design a template
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {rows.map((row) => (
            <DeliverableCard
              key={row.id}
              row={row}
              onOpen={() => setOpenId(row.id)}
              onDelete={() => {
                if (confirm(`Delete "${row.title}"? This cannot be undone.`)) {
                  del.mutate(row.id);
                }
              }}
            />
          ))}
        </div>
      )}

      <CreateDeliverableDialog
        dealId={dealId}
        workspaceId={workspaceId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onManageTemplates={() => {
          setCreateOpen(false);
          setTemplatesOpen(true);
        }}
      />
      {workspaceId && (
        <TemplateManagerDialog
          workspaceId={workspaceId}
          open={templatesOpen}
          onOpenChange={setTemplatesOpen}
        />
      )}
      {openId && (
        <DeliverableWorkspace
          deliverableId={openId}
          open={!!openId}
          onOpenChange={(v) => !v && setOpenId(null)}
        />
      )}
    </div>
  );
}
