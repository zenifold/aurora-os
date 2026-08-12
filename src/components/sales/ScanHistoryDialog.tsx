import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Plus, Minus, ArrowRight } from "lucide-react";
import { useDocumentScans } from "@/hooks/use-sales-documents";
import { useState } from "react";

function confidenceBadge(c: number | null | undefined) {
  if (c == null) return null;
  const pct = Math.round(c * 100);
  const tone =
    c >= 0.85 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
    c >= 0.6 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
    "bg-destructive/15 text-destructive";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{pct}%</span>;
}

function fmt(v: unknown) {
  if (v == null) return <em className="text-muted-foreground">—</em>;
  if (typeof v === "string") return v.length > 200 ? v.slice(0, 200) + "…" : v;
  try {
    return JSON.stringify(v).slice(0, 200);
  } catch {
    return String(v);
  }
}

export function ScanHistoryDialog({
  documentId,
  documentName,
}: {
  documentId: string;
  documentName: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: scans = [], isLoading } = useDocumentScans(open ? documentId : undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Scan history">
          <History className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">Scan history — {documentName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
          {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
          {!isLoading && scans.length === 0 && (
            <div className="text-xs text-muted-foreground">No scans yet.</div>
          )}
          {scans.map((s) => {
            const diffEntries = Object.entries(s.diff ?? {});
            const confEntries = Object.entries(s.confidence ?? {});
            return (
              <div key={s.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">v{s.version}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">overall</span>
                    {confidenceBadge(s.overall_confidence)}
                  </div>
                </div>

                {s.ai_summary && (
                  <p className="rounded bg-muted/40 p-2 text-xs">{s.ai_summary}</p>
                )}

                {confEntries.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Per-field confidence
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {confEntries.map(([k, v]) => (
                        <span key={k} className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px]">
                          <span className="text-muted-foreground">{k}</span>
                          {confidenceBadge(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {diffEntries.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Changes vs previous scan
                    </div>
                    <ul className="space-y-1">
                      {diffEntries.map(([k, d]) => (
                        <li key={k} className="rounded border border-border p-2 text-xs">
                          <div className="flex items-center gap-2 font-medium">
                            {d.change === "added" && <Plus className="h-3 w-3 text-emerald-500" />}
                            {d.change === "removed" && <Minus className="h-3 w-3 text-destructive" />}
                            {d.change === "changed" && <ArrowRight className="h-3 w-3 text-amber-500" />}
                            {k}
                            <Badge variant="outline" className="text-[9px] capitalize">
                              {d.change}
                            </Badge>
                          </div>
                          {d.change !== "added" && (
                            <div className="mt-1 text-muted-foreground">
                              <span className="text-[10px] uppercase">before: </span>
                              {fmt(d.before)}
                            </div>
                          )}
                          {d.change !== "removed" && (
                            <div className="mt-0.5 text-foreground">
                              <span className="text-[10px] uppercase text-muted-foreground">after: </span>
                              {fmt(d.after)}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">No changes from previous scan.</div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
