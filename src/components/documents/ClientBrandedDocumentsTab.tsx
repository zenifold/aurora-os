import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { FileText, Plus, Sparkles, MoreHorizontal, Trash2, Palette } from "lucide-react";
import { BrandKitManagerDialog } from "./BrandKitManagerDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";
import {
  useClientDocuments,
  useSetDocumentStatus,
} from "@/hooks/use-documents";
import {
  DOC_KIND_LIST,
  DOC_KINDS,
  DOC_STATUS_LABEL,
  DOC_STATUS_TONE,
  type DocKind,
  type DocStatus,
} from "@/lib/document-types";
import { NewDocumentDialog } from "./NewDocumentDialog";
import { useDeletePage } from "@/hooks/use-pages";
import { cn } from "@/lib/utils";

interface ClientBrandedDocumentsTabProps {
  workspaceId: string;
  clientAccountId: string;
  /** When provided, limits the list (used by overview card). */
  limit?: number;
  compact?: boolean;
}

const STATUSES: DocStatus[] = ["draft", "review", "sent", "signed", "archived"];

export function ClientBrandedDocumentsTab({
  workspaceId,
  clientAccountId,
  limit,
  compact,
}: ClientBrandedDocumentsTabProps) {
  const { data: docs = [], isLoading } = useClientDocuments(clientAccountId);
  const [open, setOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState<DocKind>("proposal");
  const [brandOpen, setBrandOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<DocKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "all">("all");

  const setStatus = useSetDocumentStatus(clientAccountId);
  const deletePage = useDeletePage();

  const filtered = docs
    .filter((d) => kindFilter === "all" || d.doc_kind === kindFilter)
    .filter((d) => statusFilter === "all" || d.doc_status === statusFilter)
    .filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()))
    .slice(0, limit);

  const launch = (kind: DocKind) => {
    setDefaultKind(kind);
    setOpen(true);
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="h-9"
            />
          </div>
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {DOC_KIND_LIST.map((d) => (
                <SelectItem key={d.kind} value={d.kind}>{d.icon} {d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{DOC_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setBrandOpen(true)} className="h-9">
            <Palette className="h-4 w-4 mr-1" /> Brand kits
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> New document
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => launch("proposal")}>
                <Sparkles className="h-4 w-4 mr-2" /> Quick start (Proposal)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {DOC_KIND_LIST.map((d) => (
                <DropdownMenuItem key={d.kind} onClick={() => launch(d.kind)}>
                  <span className="mr-2">{d.icon}</span> New {d.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-4"><ListSkeleton rows={4} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <FileText className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No branded documents yet.</p>
            {!compact && (
              <Button variant="outline" size="sm" onClick={() => launch("proposal")}>
                <Plus className="h-4 w-4 mr-1" /> Create first document
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((d) => {
              const def = d.doc_kind ? DOC_KINDS[d.doc_kind] : null;
              return (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30">
                  <span className="text-base">{d.icon ?? def?.icon ?? "📄"}</span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/app/pages"
                      search={{ p: d.id } as never}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {d.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {def && <span>{def.label}</span>}
                      <span>·</span>
                      <span>{format(new Date(d.updated_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", DOC_STATUS_TONE[d.doc_status])}>
                    {DOC_STATUS_LABEL[d.doc_status]}
                  </span>
                  {!compact && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {STATUSES.filter((s) => s !== d.doc_status).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => setStatus.mutate({ page_id: d.id, doc_status: s })}
                          >
                            Mark as {DOC_STATUS_LABEL[s].toLowerCase()}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (window.confirm(`Delete "${d.title}"?`)) {
                              deletePage.mutate(d.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {compact && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => launch("proposal")}>
            <Plus className="h-4 w-4 mr-1" /> New document
          </Button>
        </div>
      )}

      <NewDocumentDialog
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        clientAccountId={clientAccountId}
        defaultKind={defaultKind}
      />
      <BrandKitManagerDialog
        open={brandOpen}
        onOpenChange={setBrandOpen}
        workspaceId={workspaceId}
        clientAccountId={clientAccountId}
      />
    </div>
  );
}

export function ClientBrandedDocsCard({
  workspaceId,
  clientAccountId,
}: {
  workspaceId: string;
  clientAccountId: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-sm">Branded documents</h2>
        <Badge variant="outline" className="text-[10px]">Recent</Badge>
      </div>
      <ClientBrandedDocumentsTab
        workspaceId={workspaceId}
        clientAccountId={clientAccountId}
        limit={5}
        compact
      />
    </Card>
  );
}
