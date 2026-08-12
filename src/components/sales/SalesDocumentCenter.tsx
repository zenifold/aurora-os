import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Upload,
  Sparkles,
  Trash2,
  FileText,
  Download,
  Plus,
  Wand2,
} from "lucide-react";
import {
  useSalesDocuments,
  useUploadSalesDocument,
  useAddSalesNote,
  useDeleteSalesDocument,
  useScanSalesDocument,
  useDownloadSalesDoc,
  type SalesDocument,
} from "@/hooks/use-sales-documents";
import { ScanHistoryDialog } from "@/components/sales/ScanHistoryDialog";

const DOC_TYPES: SalesDocument["document_type"][] = [
  "rfp",
  "spec",
  "requirements",
  "transcript",
  "deck",
  "email",
  "wireframe",
  "contract",
  "reference",
  "screenshot",
  "other",
];

export function SalesDocumentCenter({ dealId }: { dealId: string }) {
  const { data: docs = [], isLoading } = useSalesDocuments(dealId);
  const upload = useUploadSalesDocument(dealId);
  const addNote = useAddSalesNote(dealId);
  const del = useDeleteSalesDocument(dealId);
  const scan = useScanSalesDocument(dealId);
  const download = useDownloadSalesDoc();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<SalesDocument["document_type"]>("rfp");
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState({ name: "", raw_text: "", type: "transcript" as SalesDocument["document_type"] });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    let raw_text: string | undefined;
    if (file.type.startsWith("text/") || /\.(md|txt|csv|json)$/i.test(file.name)) {
      try {
        raw_text = (await file.text()).slice(0, 200_000);
      } catch {
        // ignore
      }
    }
    upload.mutate({ file, document_type: docType, raw_text });
  };

  const submitNote = () => {
    if (!note.name.trim() || !note.raw_text.trim()) return;
    addNote.mutate(
      { name: note.name.trim(), raw_text: note.raw_text.trim(), document_type: note.type },
      {
        onSuccess: () => {
          setNote({ name: "", raw_text: "", type: "transcript" });
          setShowNote(false);
        },
      },
    );
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" />
            Discovery document center
          </div>
          <div className="text-xs text-muted-foreground">
            Upload RFPs, call transcripts, decks, requirements docs. AI scans each one to
            extract features, integrations, budget, timeline, and risks — then enriches the
            discovery brief.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={docType} onValueChange={(v) => setDocType(v as SalesDocument["document_type"])}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-3.5 w-3.5" />
          )}
          Upload
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowNote((v) => !v)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add note / transcript
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Tip: paste text-based docs as notes for instant AI scanning.
        </span>
      </div>

      {showNote && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Document name"
              value={note.name}
              onChange={(e) => setNote((p) => ({ ...p, name: e.target.value }))}
              className="col-span-2 h-8 text-xs"
            />
            <Select value={note.type} onValueChange={(v) => setNote((p) => ({ ...p, type: v as SalesDocument["document_type"] }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Paste call transcript, email thread, requirements text…"
            rows={5}
            value={note.raw_text}
            onChange={(e) => setNote((p) => ({ ...p, raw_text: e.target.value }))}
            className="text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowNote(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitNote} disabled={addNote.isPending}>
              {addNote.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading documents…</div>
      ) : docs.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No documents yet. Upload an RFP, paste a call transcript, or add requirements notes
          to give the AI something to scan.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const scanned = !!d.ai_scanned_at;
            const canScan = !!(d.raw_text || d.description);
            return (
              <li
                key={d.id}
                className="rounded-md border border-border bg-background p-2.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium truncate">{d.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {d.document_type}
                      </Badge>
                      {scanned && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Sparkles className="mr-1 h-2.5 w-2.5" /> scanned v{(d as SalesDocument & { scan_version?: number }).scan_version ?? 1}
                        </Badge>
                      )}
                      {typeof (d as SalesDocument & { last_scan_confidence?: number | null }).last_scan_confidence === "number" && (
                        <Badge variant="outline" className="text-[10px]">
                          {Math.round(((d as SalesDocument & { last_scan_confidence?: number }).last_scan_confidence ?? 0) * 100)}% conf
                        </Badge>
                      )}
                    </div>
                    {d.ai_summary && (
                      <p className="mt-1 text-muted-foreground line-clamp-3">{d.ai_summary}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {d.storage_path && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => download.mutate(d.id)}
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {scanned && <ScanHistoryDialog documentId={d.id} documentName={d.name} />}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => scan.mutate(d.id)}
                      disabled={scan.isPending || !canScan}
                      title={canScan ? "Scan with AI" : "Add text first to scan"}
                    >
                      {scan.isPending ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="mr-1 h-3.5 w-3.5" />
                      )}
                      Scan
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => del.mutate(d.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {docs.length > 0 && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          {docs.filter((d) => d.ai_scanned_at).length} of {docs.length} document(s) scanned —
          scanned docs feed directly into the discovery brief on Draft / Redraft.
        </div>
      )}
    </div>
  );
}

export function ExtractedInsightsSummary({ docs }: { docs: SalesDocument[] }) {
  const scanned = docs.filter((d) => d.ai_scanned_at);
  if (scanned.length === 0) return null;
  const platforms = new Set<string>();
  const integrations = new Set<string>();
  let budgetMin: number | null = null;
  let budgetMax: number | null = null;
  let timeline: number | null = null;
  for (const d of scanned) {
    const ex = d.ai_extracted as Record<string, unknown>;
    for (const p of Array.isArray(ex.platforms) ? (ex.platforms as unknown[]) : []) platforms.add(String(p));
    for (const i of Array.isArray(ex.integrations) ? (ex.integrations as unknown[]) : []) integrations.add(String(i));
    if (typeof ex.budget_min === "number") budgetMin = budgetMin == null ? ex.budget_min : Math.min(budgetMin, ex.budget_min);
    if (typeof ex.budget_max === "number") budgetMax = budgetMax == null ? ex.budget_max : Math.max(budgetMax, ex.budget_max);
    if (typeof ex.timeline_weeks === "number") timeline = ex.timeline_weeks;
  }
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-1.5">
      <div className="font-medium text-foreground">AI-extracted signals from scanned docs</div>
      {platforms.size > 0 && (
        <div>
          <span className="text-muted-foreground">Platforms: </span>
          {[...platforms].map((p) => (
            <Badge key={p} variant="secondary" className="mr-1 text-[10px]">
              {p}
            </Badge>
          ))}
        </div>
      )}
      {integrations.size > 0 && (
        <div>
          <span className="text-muted-foreground">Integrations: </span>
          {[...integrations].map((i) => (
            <Badge key={i} variant="outline" className="mr-1 text-[10px]">
              {i}
            </Badge>
          ))}
        </div>
      )}
      {(budgetMin != null || budgetMax != null) && (
        <div>
          <span className="text-muted-foreground">Budget: </span>
          {budgetMin?.toLocaleString() ?? "?"} – {budgetMax?.toLocaleString() ?? "?"}
        </div>
      )}
      {timeline != null && (
        <div>
          <span className="text-muted-foreground">Timeline: </span>~{timeline} weeks
        </div>
      )}
    </div>
  );
}
