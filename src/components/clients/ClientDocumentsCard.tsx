import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { format, differenceInDays, isPast } from "date-fns";
import { FileText, Search, Download, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";
import { useProjectDocuments, getDocumentSignedUrl } from "@/hooks/use-resources";
import {
  DOC_TYPE_LABELS,
  type DocumentType,
  type ProjectDocument,
  type SignatureStatus,
} from "@/lib/resource-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SIG_LABELS: Record<SignatureStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  expired: "Expired",
  declined: "Declined",
  not_required: "—",
};

const SIG_TONE: Record<SignatureStatus, string> = {
  draft: "bg-muted text-foreground",
  sent: "bg-blue-500/10 text-blue-600",
  viewed: "bg-amber-500/10 text-amber-600",
  signed: "bg-emerald-500/10 text-emerald-600",
  expired: "bg-destructive/10 text-destructive",
  declined: "bg-destructive/10 text-destructive",
  not_required: "bg-muted text-muted-foreground",
};

type SortKey = "name" | "type" | "project" | "value" | "expires" | "signature" | "created";
type SortDir = "asc" | "desc";

function fmtMoney(n: number | null, currency: string | null) {
  if (n == null) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function expiresInfo(date: string | null) {
  if (!date) return { label: "—", tone: "text-muted-foreground", sort: Number.POSITIVE_INFINITY };
  const d = new Date(date);
  const days = differenceInDays(d, new Date());
  if (isPast(d) && days < 0)
    return { label: `Expired ${Math.abs(days)}d ago`, tone: "text-destructive", sort: days };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: "text-amber-600", sort: days };
  return { label: format(d, "MMM d, yyyy"), tone: "text-muted-foreground", sort: days };
}

export function ClientDocumentsCard({
  projects,
}: {
  projects: Array<{ id: string; name: string }>;
}) {
  const { data: allDocs = [], isLoading } = useProjectDocuments();
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const clientDocs = useMemo(
    () => allDocs.filter((d) => d.project_id && projectIds.has(d.project_id)),
    [allDocs, projectIds],
  );

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [sigFilter, setSigFilter] = useState<SignatureStatus | "all" | "outstanding">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clientDocs.filter((d) => {
      if (typeFilter !== "all" && d.document_type !== typeFilter) return false;
      if (projectFilter !== "all" && d.project_id !== projectFilter) return false;
      if (sigFilter === "outstanding") {
        if (!["sent", "viewed", "draft"].includes(d.signature_status)) return false;
      } else if (sigFilter !== "all" && d.signature_status !== sigFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.description ?? "").toLowerCase().includes(q))
        return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: ProjectDocument, b: ProjectDocument) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "type":
          return a.document_type.localeCompare(b.document_type) * dir;
        case "project": {
          const an = a.project_id ? projectById.get(a.project_id)?.name ?? "" : "";
          const bn = b.project_id ? projectById.get(b.project_id)?.name ?? "" : "";
          return an.localeCompare(bn) * dir;
        }
        case "value":
          return ((a.contract_value ?? -1) - (b.contract_value ?? -1)) * dir;
        case "expires":
          return (expiresInfo(a.expiration_date).sort - expiresInfo(b.expiration_date).sort) * dir;
        case "signature":
          return a.signature_status.localeCompare(b.signature_status) * dir;
        case "created":
        default:
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
    };
    return [...list].sort(cmp);
  }, [clientDocs, search, typeFilter, sigFilter, projectFilter, sortKey, sortDir, projectById]);

  const totalSignedValue = useMemo(
    () =>
      clientDocs
        .filter((d) => d.signature_status === "signed" && d.contract_value)
        .reduce((s, d) => s + (d.contract_value ?? 0), 0),
    [clientDocs],
  );
  const awaitingCount = clientDocs.filter((d) =>
    ["sent", "viewed", "draft"].includes(d.signature_status),
  ).length;
  const expiringCount = clientDocs.filter((d) => {
    if (!d.expiration_date) return false;
    const days = differenceInDays(new Date(d.expiration_date), new Date());
    return days >= 0 && days <= 60;
  }).length;

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" || k === "type" || k === "project" ? "asc" : "desc");
    }
  };

  const SortHead = ({ k, children, align = "left" }: { k: SortKey; children: React.ReactNode; align?: "left" | "right" }) => (
    <th className={cn("px-3 py-2 font-semibold", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        {sortKey === k ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );

  const openDoc = async (doc: ProjectDocument) => {
    try {
      const url = await getDocumentSignedUrl(doc.file_path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Signed value</div>
          <div className="mt-0.5 text-lg font-semibold">
            {fmtMoney(totalSignedValue, "USD") ?? "—"}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Awaiting signature</div>
          <div className={cn("mt-0.5 text-lg font-semibold", awaitingCount && "text-blue-600")}>
            {awaitingCount}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expiring in 60d</div>
          <div className={cn("mt-0.5 text-lg font-semibold", expiringCount && "text-amber-600")}>
            {expiringCount}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((t) => (
              <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sigFilter} onValueChange={(v) => setSigFilter(v as typeof sigFilter)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any signature</SelectItem>
            <SelectItem value="outstanding">Outstanding</SelectItem>
            <SelectItem value="signed">Signed</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="viewed">Viewed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
        {projects.length > 1 && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All engagements</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(search || typeFilter !== "all" || sigFilter !== "all" || projectFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => {
            setSearch(""); setTypeFilter("all"); setSigFilter("all"); setProjectFilter("all");
          }}>Clear</Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-4"><ListSkeleton rows={6} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <FileText className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">
              {clientDocs.length === 0 ? "No documents yet." : "No documents match these filters."}
            </p>
            <p className="text-xs">Upload SOWs and contracts from an engagement's Documents tab.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <SortHead k="name">Document</SortHead>
                  <SortHead k="type">Type</SortHead>
                  <SortHead k="project">Engagement</SortHead>
                  <SortHead k="value" align="right">Value</SortHead>
                  <SortHead k="expires">Expires</SortHead>
                  <SortHead k="signature">Signature</SortHead>
                  <SortHead k="created">Added</SortHead>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const project = d.project_id ? projectById.get(d.project_id) : null;
                  const exp = expiresInfo(d.expiration_date);
                  const value = fmtMoney(d.contract_value, d.currency);
                  return (
                    <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-accent/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{d.name}</div>
                            {d.version > 1 && (
                              <div className="text-[10px] text-muted-foreground">v{d.version}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {DOC_TYPE_LABELS[d.document_type]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {project ? (
                          <Link
                            to="/app/p/$projectId/documents"
                            params={{ projectId: project.id }}
                            className="text-primary hover:underline"
                          >
                            {project.name}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{value ?? "—"}</td>
                      <td className={cn("px-3 py-2 text-xs", exp.tone)}>{exp.label}</td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", SIG_TONE[d.signature_status])}>
                          {SIG_LABELS[d.signature_status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {format(new Date(d.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDoc(d)} title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {project && (
                            <Link
                              to="/app/p/$projectId/documents"
                              params={{ projectId: project.id }}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                              title="Open in engagement"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
