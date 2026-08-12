import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchPortalDocumentUrl,
  usePortalDocuments,
  type PortalDocument,
} from "@/hooks/use-client-portal";
import { FileText, Download, ShieldCheck, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  contract: "Contract",
  sow: "Statement of Work",
  msa: "Master Agreement",
  nda: "NDA",
  proposal: "Proposal",
  invoice: "Invoice",
  brief: "Brief",
  other: "Document",
};

function isExpired(d: PortalDocument): boolean {
  if (!d.expiration_date) return false;
  return new Date(d.expiration_date).getTime() < Date.now();
}

function isExpiringSoon(d: PortalDocument): boolean {
  if (!d.expiration_date) return false;
  const diff = new Date(d.expiration_date).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 3600 * 1000;
}

export function PortalDocuments({
  token,
  enabled,
}: {
  token: string;
  enabled: boolean;
}) {
  const { data: documents = [], isLoading } = usePortalDocuments(token, enabled);

  if (!enabled || isLoading) return null;
  if (documents.length === 0) return null;

  const handleDownload = async (id: string) => {
    try {
      const url = await fetchPortalDocumentUrl(token, id);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <FileText className="h-4 w-4" /> Documents · {documents.length}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {documents.map((d) => {
          const expired = isExpired(d);
          const soon = isExpiringSoon(d);
          return (
            <Card key={d.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{TYPE_LABELS[d.document_type] ?? d.document_type}</Badge>
                    {d.signature_status === "signed" && (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Signed
                      </Badge>
                    )}
                    {expired && <Badge variant="destructive">Expired</Badge>}
                    {soon && !expired && (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Expiring soon
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold">{d.name}</p>
                  {d.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{d.description}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {d.effective_date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Effective{" "}
                    {new Date(d.effective_date).toLocaleDateString()}
                  </span>
                )}
                {d.expiration_date && (
                  <span className="inline-flex items-center gap-1">
                    Expires {new Date(d.expiration_date).toLocaleDateString()}
                  </span>
                )}
                <span>v{d.version}</span>
                {d.file_size_bytes && (
                  <span>{Math.round(d.file_size_bytes / 1024)} KB</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleDownload(d.id)}
              >
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
