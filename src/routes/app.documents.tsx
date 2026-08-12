import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, differenceInDays, isPast } from "date-fns";
import {
  FileText,
  Search,
  DollarSign,
  AlertTriangle,
  FileSignature,
  Download,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/loading-scaffolds";
import { useProjectDocuments, getDocumentSignedUrl } from "@/hooks/use-resources";
import { useProjects } from "@/hooks/use-projects";
import {
  DOC_TYPE_LABELS,
  type DocumentType,
  type ProjectDocument,
  type SignatureStatus,
} from "@/lib/resource-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/documents")({
  component: DocumentsHubPage,
});

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

function fmtMoney(n: number | null, currency: string | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function expiresLabel(date: string | null): { label: string; tone: string } | null {
  if (!date) return null;
  const d = new Date(date);
  const days = differenceInDays(d, new Date());
  if (isPast(d) && days < 0) return { label: `Expired ${Math.abs(days)}d ago`, tone: "text-destructive" };
  if (days <= 30) return { label: `Expires in ${days}d`, tone: "text-amber-600" };
  if (days <= 90) return { label: `Expires in ${days}d`, tone: "text-foreground/70" };
  return { label: format(d, "MMM d, yyyy"), tone: "text-muted-foreground" };
}

function DocumentsHubPage() {
  const { data: docs = [], isLoading } = useProjectDocuments();
  const { data: projects = [] } = useProjects();
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [sigFilter, setSigFilter] = useState<SignatureStatus | "all" | "outstanding">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (typeFilter !== "all" && d.document_type !== typeFilter) return false;
      if (projectFilter === "workspace" && d.project_id) return false;
      if (projectFilter !== "all" && projectFilter !== "workspace" && d.project_id !== projectFilter) return false;
      if (sigFilter === "outstanding") {
        if (!["sent", "viewed", "draft"].includes(d.signature_status)) return false;
      } else if (sigFilter !== "all" && d.signature_status !== sigFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, search, typeFilter, sigFilter, projectFilter]);

  const kpis = useMemo(() => {
    const now = Date.now();
    let totalValue = 0;
    let activeValue = 0;
    let expiringSoon = 0;
    let awaitingSig = 0;
    let signed = 0;
    for (const d of docs) {
      if (d.contract_value) {
        totalValue += d.contract_value;
        const exp = d.expiration_date ? new Date(d.expiration_date).getTime() : Infinity;
        if (exp >= now) activeValue += d.contract_value;
      }
      if (d.expiration_date) {
        const days = differenceInDays(new Date(d.expiration_date), new Date());
        if (days >= 0 && days <= 60) expiringSoon++;
      }
      if (["sent", "viewed", "draft"].includes(d.signature_status)) awaitingSig++;
      if (d.signature_status === "signed") signed++;
    }
    return { totalValue, activeValue, expiringSoon, awaitingSig, signed };
  }, [docs]);

  const openDoc = async (doc: ProjectDocument) => {
    try {
      const url = await getDocumentSignedUrl(doc.file_path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col p-6">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FileText className="h-6 w-6" /> Documents & Contracts
        </h1>
        <p className="text-sm text-muted-foreground">
          Every SOW, MSA, proposal and signed contract across the workspace.
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Active contract value"
          value={fmtMoney(kpis.activeValue, "USD")}
          sub={`${fmtMoney(kpis.totalValue, "USD")} total signed`}
          tone="text-emerald-600"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Expiring within 60d"
          value={String(kpis.expiringSoon)}
          sub="Renew or amend"
          tone={kpis.expiringSoon ? "text-amber-600" : "text-muted-foreground"}
        />
        <KpiCard
          icon={FileSignature}
          label="Awaiting signature"
          value={String(kpis.awaitingSig)}
          sub="Draft / sent / viewed"
          tone={kpis.awaitingSig ? "text-blue-600" : "text-muted-foreground"}
        />
        <KpiCard
          icon={ShieldCheck}
          label="Signed documents"
          value={String(kpis.signed)}
          sub="Fully executed"
          tone="text-foreground/80"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {DOC_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sigFilter} onValueChange={(v) => setSigFilter(v as typeof sigFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
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
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem value="workspace">Workspace-level only</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || typeFilter !== "all" || sigFilter !== "all" || projectFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setTypeFilter("all");
              setSigFilter("all");
              setProjectFilter("all");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-4">
            <ListSkeleton rows={8} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <FileText className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">No documents match these filters.</p>
            <p className="text-xs">Upload SOWs and contracts from a project's Documents tab.</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] border-b border-border bg-card text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Document</th>
                  <th className="px-4 py-2 text-left font-semibold">Project</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-right font-semibold">Value</th>
                  <th className="px-4 py-2 text-left font-semibold">Expires</th>
                  <th className="px-4 py-2 text-left font-semibold">Signature</th>
                  <th className="px-4 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const project = d.project_id ? projectById.get(d.project_id) : null;
                  const exp = expiresLabel(d.expiration_date);
                  return (
                    <tr key={d.id} className="border-b border-border/60 hover:bg-accent/30">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{d.name}</div>
                        {d.version > 1 && (
                          <div className="text-[11px] text-muted-foreground">v{d.version}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {project ? (
                          <Link
                            to="/app/p/$projectId/documents"
                            params={{ projectId: project.id }}
                            className="text-primary hover:underline"
                          >
                            {project.name}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">Workspace</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {DOC_TYPE_LABELS[d.document_type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {fmtMoney(d.contract_value, d.currency)}
                      </td>
                      <td className={cn("px-4 py-2.5 text-xs", exp?.tone ?? "text-muted-foreground")}>
                        {exp?.label ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            SIG_TONE[d.signature_status],
                          )}
                        >
                          {SIG_LABELS[d.signature_status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openDoc(d)}
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {project && (
                            <Link
                              to="/app/p/$projectId/documents"
                              params={{ projectId: project.id }}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                              title="Open in project"
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

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted", tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-0.5 text-xl font-semibold">{value}</div>
          <div className="text-[11px] text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}
