import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useProject } from "@/hooks/use-projects";
import {
  useProjectDocuments,
  useUploadDocument,
  useDeleteDocument,
  getDocumentSignedUrl,
} from "@/hooks/use-resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Trash2, Upload } from "lucide-react";
import {
  DOC_TYPE_LABELS,
  type DocumentType,
  type ProjectDocument,
} from "@/lib/resource-types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/p/$projectId/documents")({
  component: DocumentsPage,
});

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: docs = [] } = useProjectDocuments(projectId);
  const upload = useUploadDocument();
  const del = useDeleteDocument();

  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("sow");
  const [contractValue, setContractValue] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  const onPick = () => fileRef.current?.click();

  const onFile = async (file: File) => {
    await upload.mutateAsync({
      file,
      project_id: projectId,
      document_type: docType,
      contract_value: contractValue ? Number(contractValue) : null,
      effective_date: effectiveDate || null,
      expiration_date: expirationDate || null,
    });
    setContractValue("");
    setEffectiveDate("");
    setExpirationDate("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDownload = async (d: ProjectDocument) => {
    try {
      const url = await getDocumentSignedUrl(d.file_path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/p/$projectId" params={{ projectId }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{project?.name ?? "Project"}</h1>
          <p className="text-xs text-muted-foreground">Documents & contracts</p>
        </div>
      </div>

      <div className="border-b border-border bg-muted/20 px-6 py-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="grid gap-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((t) => (
                  <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Contract value</Label>
            <Input
              type="number"
              placeholder="Optional"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Effective</Label>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="h-9" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Expires</Label>
            <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="h-9" />
          </div>
          <div className="flex items-end">
            <Button onClick={onPick} disabled={upload.isPending} className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              {upload.isPending ? "Uploading…" : "Upload file"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {docs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p className="text-sm">No documents yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Value</th>
                  <th className="px-3 py-2 text-left">Effective</th>
                  <th className="px-3 py-2 text-left">Expires</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{DOC_TYPE_LABELS[d.document_type]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {d.contract_value != null ? `${d.currency ?? "USD"} ${d.contract_value.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{d.effective_date ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.expiration_date ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtSize(d.file_size_bytes)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => onDownload(d)} aria-label="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(d)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
