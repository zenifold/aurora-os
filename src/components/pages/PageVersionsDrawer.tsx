import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RotateCcw, Sparkles, History } from "lucide-react";
import {
  listDocVersions,
  restoreDocVersion,
  getDocVersion,
  updateVersionStatus,
} from "@/server/page-doc-ai.functions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Version {
  id: string;
  version_number: number | null;
  version_label: string | null;
  status: string;
  generated_by_ai: boolean;
  ai_prompt: string | null;
  ai_model: string | null;
  changes_summary: string | null;
  edited_by: string | null;
  created_at: string;
  title: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  refreshKey: number;
  onRestored: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground line-through",
};

export function PageVersionsDrawer({ open, onOpenChange, pageId, refreshKey, onRestored }: Props) {
  const listFn = useServerFn(listDocVersions);
  const restoreFn = useServerFn(restoreDocVersion);
  const getFn = useServerFn(getDocVersion);
  const statusFn = useServerFn(updateVersionStatus);

  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setLoading(true);
    listFn({ data: { page_id: pageId, limit: 100 } })
      .then((r) => {
        if (cancel) return;
        if ("versions" in r) setVersions(r.versions as Version[]);
      })
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [open, pageId, refreshKey, listFn]);

  const preview = async (id: string) => {
    setPreviewing(id);
    setPreviewText("Loading…");
    const r = await getFn({ data: { version_id: id } });
    if ("version" in r && r.version) {
      const text = extractText(r.version.content);
      setPreviewText(text || "(empty)");
    } else {
      setPreviewText("Could not load");
    }
  };

  const restore = async (id: string) => {
    setBusy(id);
    try {
      const r = await restoreFn({ data: { version_id: id } });
      if ("error" in r && r.error) toast.error(r.error);
      else {
        toast.success("Version restored");
        onRestored();
        onOpenChange(false);
      }
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (id: string, status: "draft" | "review" | "published" | "archived") => {
    setBusy(id);
    try {
      await statusFn({ data: { version_id: id, status } });
      setVersions((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Document versions
          </SheetTitle>
          <SheetDescription className="text-xs">
            Every save is captured. Restore, label, or publish any version.
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
          <div className="overflow-auto border-r border-border">
            {loading ? (
              <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No versions yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className={`cursor-pointer px-3 py-2.5 text-xs hover:bg-muted/50 ${
                      previewing === v.id ? "bg-muted" : ""
                    }`}
                    onClick={() => preview(v.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{v.version_number ?? "?"}</span>
                      {v.version_label && <span className="text-muted-foreground">· {v.version_label}</span>}
                      {v.generated_by_ai && (
                        <Badge variant="outline" className="ml-auto h-4 gap-1 px-1 text-[10px] text-primary">
                          <Sparkles className="h-2.5 w-2.5" /> AI
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-muted-foreground">{v.title}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_COLORS[v.status] ?? ""}`}>
                        {v.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {v.changes_summary && (
                      <div className="mt-1 line-clamp-2 text-[11px] italic text-muted-foreground">
                        {v.changes_summary}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col overflow-hidden">
            {previewing ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 gap-1"
                    disabled={busy === previewing}
                    onClick={() => restore(previewing)}
                  >
                    {busy === previewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Restore
                  </Button>
                  <div className="ml-auto flex gap-1">
                    {(["draft", "review", "published", "archived"] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] capitalize"
                        onClick={() => setStatus(previewing, s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <pre className="whitespace-pre-wrap break-words p-4 text-xs leading-relaxed">
                    {previewText}
                  </pre>
                </ScrollArea>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
                Select a version to preview
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function extractText(doc: unknown): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { text?: string; content?: unknown[]; type?: string };
    if (node.text) out.push(node.text);
    if (node.type === "heading") out.push("\n");
    if (node.content) node.content.forEach(walk);
    if (node.type === "paragraph" || node.type === "heading") out.push("\n");
  };
  walk(doc);
  return out.join("").trim();
}
