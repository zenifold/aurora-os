import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, FileText } from "lucide-react";
import {
  useDocumentTemplates,
  useCreateDocumentFromTemplate,
  useGenerateClientDocument,
  useBrandKits,
} from "@/hooks/use-documents";
import { DOC_KIND_LIST, DOC_KINDS, type DocKind } from "@/lib/document-types";

interface NewDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  clientAccountId?: string | null;
  defaultKind?: DocKind;
}

export function NewDocumentDialog({
  open,
  onOpenChange,
  workspaceId,
  clientAccountId,
  defaultKind = "proposal",
}: NewDocumentDialogProps) {
  const [mode, setMode] = useState<"template" | "ai">("template");
  const [kind, setKind] = useState<DocKind>(defaultKind);
  const [templateId, setTemplateId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [brandKitId, setBrandKitId] = useState<string>("none");

  const { data: templates = [] } = useDocumentTemplates(workspaceId, kind);
  const { data: brandKits = [] } = useBrandKits(workspaceId, clientAccountId);

  const createFromTemplate = useCreateDocumentFromTemplate(clientAccountId ?? undefined);
  const generateAi = useGenerateClientDocument(clientAccountId ?? undefined);

  const navigate = useNavigate();

  const reset = () => {
    setTitle("");
    setPrompt("");
    setTemplateId("");
    setBrandKitId("none");
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const onCreate = async () => {
    if (!title.trim()) return;
    const brand_kit_id = brandKitId === "none" ? null : brandKitId;
    if (mode === "template") {
      const res = await createFromTemplate.mutateAsync({
        workspace_id: workspaceId,
        template_id: templateId || null,
        doc_kind: kind,
        client_account_id: clientAccountId ?? null,
        title: title.trim(),
        brand_kit_id,
      });
      close();
      if (res?.id) navigate({ to: "/app/pages", search: { p: res.id } as never });
    } else {
      const res = (await generateAi.mutateAsync({
        workspace_id: workspaceId,
        client_account_id: clientAccountId ?? null,
        doc_kind: kind,
        title: title.trim(),
        prompt: prompt.trim(),
        template_id: templateId || null,
        brand_kit_id,
      })) as { ok?: boolean; page?: { id: string } };
      if (res?.ok && res.page?.id) {
        close();
        navigate({ to: "/app/pages", search: { p: res.page.id } as never });
      }
    }
  };

  const busy = createFromTemplate.isPending || generateAi.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New document</DialogTitle>
          <DialogDescription>
            Start from a branded template or let AI draft it for you.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">
              <FileText className="h-4 w-4 mr-1" /> From template
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles className="h-4 w-4 mr-1" /> Generate with AI
            </TabsTrigger>
          </TabsList>

          <div className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Document type</Label>
                <Select value={kind} onValueChange={(v) => { setKind(v as DocKind); setTemplateId(""); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_KIND_LIST.map((d) => (
                      <SelectItem key={d.kind} value={d.kind}>
                        {d.icon} {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Brand kit</Label>
                <Select value={brandKitId} onValueChange={setBrandKitId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (default)</SelectItem>
                    {brandKits.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{b.client_account_id ? " (client)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${DOC_KINDS[kind].label} — ...`}
                className="h-9"
              />
            </div>

            <TabsContent value="template" className="m-0 space-y-2">
              <Label className="text-xs">Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose a template (or leave blank for a fresh doc)" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No {DOC_KINDS[kind].plural.toLowerCase()} templates yet.
                    </div>
                  ) : (
                    templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.icon ?? "📄"} {t.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="ai" className="m-0 space-y-2">
              <Label className="text-xs">What should the document cover?</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Two-week discovery for Acme's onboarding redesign — three workshops, prototype, $40k fixed fee."
                className="min-h-[100px]"
              />
              <div className="text-[11px] text-muted-foreground">
                AI uses the chosen template (if any) as a structural hint.
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button
            onClick={onCreate}
            disabled={busy || !title.trim() || (mode === "ai" && !prompt.trim())}
          >
            {busy ? "Creating…" : mode === "ai" ? "Generate" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
