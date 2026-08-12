import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  Upload,
  FileUp,
  ClipboardList,
  Link2,
  AlertCircle,
  Loader2,
  X,
  Paperclip,
} from "lucide-react";

export const Route = createFileRoute("/r/$token")({
  component: ClientRequestPortalPage,
});

type ItemType = "file" | "text" | "decision" | "link";

interface PortalItem {
  id: string;
  bundle_id: string;
  label: string;
  description: string | null;
  item_type: ItemType;
  is_required: boolean;
  status: "pending" | "submitted" | "skipped";
  response_text: string | null;
  response_decision: string | null;
  response_link: string | null;
  response_files: Array<{ path: string; name: string; size?: number }>;
  submitted_at: string | null;
  sort_order: number;
}

interface PortalBundle {
  id: string;
  workspace_id: string;
  client_account_id: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  status: string;
  recipient_name: string | null;
  account_name: string;
  items: PortalItem[];
}

function ClientRequestPortalPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-request", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_request_bundle_by_token", {
        _token: token,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Not found");
      return row as unknown as PortalBundle;
    },
    retry: false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["portal-request", token] });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md p-6 text-center space-y-2">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold">Link not valid</h1>
          <p className="text-sm text-muted-foreground">
            This request link has expired or been revoked. Please contact your project team.
          </p>
        </Card>
      </div>
    );
  }

  const bundle = data;
  const items = (bundle.items ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const requiredItems = items.filter((i) => i.is_required);
  const submittedRequired = requiredItems.filter((i) => i.status === "submitted").length;
  const allDone = submittedRequired === requiredItems.length && requiredItems.length > 0;
  const pct = requiredItems.length === 0 ? 100 : Math.round((submittedRequired / requiredItems.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {bundle.account_name}
          </p>
          <h1 className="text-xl font-semibold mt-1">{bundle.title}</h1>
          {bundle.instructions && (
            <p className="text-sm text-muted-foreground mt-2">{bundle.instructions}</p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <Progress value={pct} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground tabular-nums">
              {submittedRequired}/{requiredItems.length}
            </span>
          </div>
          {bundle.due_date && (
            <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Due {new Date(bundle.due_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6 space-y-3">
        {allDone && (
          <Card className="p-4 bg-emerald-500/10 border-emerald-500/30 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium text-sm">All set — everything submitted</p>
              <p className="text-xs text-muted-foreground">
                Your team will review and reach out with any follow-ups.
              </p>
            </div>
          </Card>
        )}
        {items.map((item) => (
          <ItemCard key={item.id} item={item} token={token} onChange={refresh} />
        ))}
        {items.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No items requested yet.
          </p>
        )}
        <p className="text-xs text-center text-muted-foreground pt-6">
          Your responses are saved as you submit each item.
        </p>
      </main>
    </div>
  );
}

function ItemCard({
  item,
  token,
  onChange,
}: {
  item: PortalItem;
  token: string;
  onChange: () => void;
}) {
  const [text, setText] = useState(item.response_text ?? "");
  const [linkVal, setLinkVal] = useState(item.response_link ?? "");
  const [decision, setDecision] = useState(item.response_decision ?? "");
  const [files, setFiles] = useState<Array<{ path: string; name: string; size?: number }>>(
    item.response_files ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitted = item.status === "submitted";

  const handleFiles = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    setUploading(true);
    try {
      const next = [...files];
      for (const f of Array.from(selected)) {
        if (f.size > 50 * 1024 * 1024) {
          toast.error(`${f.name} is too large (max 50MB)`);
          continue;
        }
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${item.bundle_id}/${item.id}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage
          .from("client-request-uploads")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (error) {
          toast.error(`${f.name}: ${error.message}`);
          continue;
        }
        next.push({ path, name: f.name, size: f.size });
      }
      setFiles(next);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (item.item_type === "file" && files.length === 0 && item.is_required) {
      toast.error("Please upload at least one file");
      return;
    }
    if (item.item_type === "text" && !text.trim() && item.is_required) {
      toast.error("Please enter a response");
      return;
    }
    if (item.item_type === "decision" && !decision && item.is_required) {
      toast.error("Please choose an option");
      return;
    }
    if (item.item_type === "link" && !linkVal.trim() && item.is_required) {
      toast.error("Please enter a link");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_client_request_item", {
        _token: token,
        _item_id: item.id,
        _response_text: text || undefined,
        _response_decision: decision || undefined,
        _response_link: linkVal || undefined,
        _response_files: files,
      });
      if (error) throw error;
      toast.success("Submitted");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const TypeIcon =
    item.item_type === "file"
      ? FileUp
      : item.item_type === "link"
      ? Link2
      : item.item_type === "decision"
      ? CheckCircle2
      : ClipboardList;

  return (
    <Card className={`p-4 ${submitted ? "bg-emerald-500/5 border-emerald-500/30" : ""}`}>
      <div className="flex items-start gap-3">
        <TypeIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm">{item.label}</h3>
            {!item.is_required && (
              <Badge variant="outline" className="text-xs">Optional</Badge>
            )}
            {submitted && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Submitted
              </Badge>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
          )}

          <div className="mt-3 space-y-2">
            {item.item_type === "file" && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || submitted}
                  className="gap-1.5"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? "Uploading…" : "Choose files"}
                </Button>
                {files.length > 0 && (
                  <ul className="text-sm space-y-1">
                    {files.map((f) => (
                      <li key={f.path} className="flex items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{f.name}</span>
                        {!submitted && (
                          <button
                            onClick={() => setFiles((prev) => prev.filter((x) => x.path !== f.path))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {item.item_type === "text" && (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={submitted}
                rows={3}
                placeholder="Your answer…"
              />
            )}

            {item.item_type === "link" && (
              <Input
                value={linkVal}
                onChange={(e) => setLinkVal(e.target.value)}
                disabled={submitted}
                placeholder="https://…"
              />
            )}

            {item.item_type === "decision" && (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {["Approve", "Reject", "Needs discussion"].map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      size="sm"
                      variant={decision === opt ? "default" : "outline"}
                      disabled={submitted}
                      onClick={() => setDecision(opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
                <div>
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={submitted}
                    rows={2}
                  />
                </div>
              </div>
            )}

            {!submitted && (
              <Button
                size="sm"
                onClick={submit}
                disabled={submitting || uploading}
                className="gap-1.5"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Submit
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
