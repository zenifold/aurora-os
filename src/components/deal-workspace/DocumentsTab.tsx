import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, Trash2, Upload, ExternalLink, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listDealDocuments, createDealDocument, deleteDealDocument,
  type SalesDocument,
} from "@/lib/deal-workspace.functions";
import { toast } from "sonner";

const BUCKETS = [
  { id: "all", label: "All" },
  { id: "rfp", label: "RFPs & Briefs" },
  { id: "contract", label: "Proposals & SOWs" },
  { id: "reference", label: "Reference" },
  { id: "transcript", label: "Notes & Transcripts" },
  { id: "other", label: "Other" },
] as const;

const TYPE_TO_BUCKET: Record<string, string> = {
  rfp: "rfp", spec: "rfp", requirements: "rfp",
  contract: "contract", deck: "contract",
  reference: "reference", wireframe: "reference", screenshot: "reference",
  transcript: "transcript", email: "transcript",
  other: "other",
};

export function DocumentsTab({ dealId }: { dealId: string }) {
  const list = useServerFn(listDealDocuments);
  const create = useServerFn(createDealDocument);
  const remove = useServerFn(deleteDealDocument);
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["deal-docs", dealId],
    queryFn: () => list({ data: { deal_id: dealId } }),
  });

  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("other");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const filtered = filter === "all" ? rows : rows.filter((r) => TYPE_TO_BUCKET[r.document_type] === filter);

  const reset = () => {
    setOpen(false); setName(""); setDescription(""); setType("other");
    setExternalUrl(""); setFile(null); setUploading(false); setMode("upload");
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    setUploading(true);
    try {
      let storage_path: string | null = null;
      let file_size_bytes: number | null = null;
      let mime_type: string | null = null;
      if (mode === "upload" && file) {
        const path = `${dealId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("deal-documents").upload(path, file);
        if (upErr) throw upErr;
        storage_path = path;
        file_size_bytes = file.size;
        mime_type = file.type;
      }
      await create({ data: {
        deal_id: dealId, name, description: description || null,
        document_type: type as any, source: mode === "upload" ? "upload" : "link",
        storage_path, external_url: mode === "link" ? externalUrl || null : null,
        file_size_bytes, mime_type,
      }});
      qc.invalidateQueries({ queryKey: ["deal-docs", dealId] });
      qc.invalidateQueries({ queryKey: ["deal-activities", dealId] });
      toast.success("Document added");
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add document");
    } finally {
      setUploading(false);
    }
  };

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-docs", dealId] });
      toast.success("Removed");
    },
  });

  const openDoc = async (doc: SalesDocument) => {
    if (doc.external_url) { window.open(doc.external_url, "_blank"); return; }
    if (doc.storage_path) {
      const { data, error } = await supabase.storage.from("deal-documents")
        .createSignedUrl(doc.storage_path, 60 * 10);
      if (error) { toast.error(error.message); return; }
      window.open(data.signedUrl, "_blank");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="w-max">
              {BUCKETS.map((b) => <TabsTrigger key={b.id} value={b.id} className="whitespace-nowrap">{b.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="shrink-0"><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          Drop in RFPs, proposals, SOWs, transcripts. Everything stays attached to this opportunity.
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((d) => (
            <Card key={d.id} className="p-4 flex items-start gap-3 hover:bg-accent/40 transition-colors">
              <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <button onClick={() => openDoc(d)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{d.name}</span>
                  <Badge variant="outline" className="text-xs capitalize">{d.document_type}</Badge>
                  <Badge variant="secondary" className="text-xs">{d.source}</Badge>
                </div>
                {d.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(d.created_at).toLocaleDateString()}
                  {d.file_size_bytes ? ` · ${Math.round(d.file_size_bytes / 1024)} KB` : ""}
                </p>
              </button>
              <Button variant="ghost" size="icon" onClick={() => openDoc(d)}>
                {d.external_url ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => {
                if (confirm(`Delete "${d.name}"?`)) removeMut.mutate(d.id);
              }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add document</DialogTitle></DialogHeader>
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-1.5" />Upload file</TabsTrigger>
              <TabsTrigger value="link"><ExternalLink className="h-4 w-4 mr-1.5" />Link</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-3 mt-3">
            {mode === "upload" ? (
              <Input type="file" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) { setFile(f); if (!name) setName(f.name); }
              }} />
            ) : (
              <Input placeholder="https://..." value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
            )}
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rfp">RFP</SelectItem>
                <SelectItem value="spec">Spec</SelectItem>
                <SelectItem value="requirements">Requirements</SelectItem>
                <SelectItem value="contract">Contract / SOW</SelectItem>
                <SelectItem value="deck">Deck / Proposal</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
                <SelectItem value="wireframe">Wireframe</SelectItem>
                <SelectItem value="screenshot">Screenshot</SelectItem>
                <SelectItem value="transcript">Transcript</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={uploading || !name.trim() || (mode === "upload" && !file) || (mode === "link" && !externalUrl.trim())}>
              {uploading ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
