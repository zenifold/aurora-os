import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useWorkspaceAiKey } from "@/hooks/use-ai";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyRound, Sparkles, ExternalLink, Bot, Mic } from "lucide-react";

const STORAGE_PREFIX = "aura.openrouterPrompt.dismissed.";

export function OpenRouterFirstRun() {
  const workspace = useWorkspaceStore((s) => s.current);
  const { data: keyRow, isLoading } = useWorkspaceAiKey();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!workspace || isLoading) return;
    if (keyRow?.openrouter_api_key) return;
    const dismissed =
      typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_PREFIX + workspace.id) === "1";
    if (dismissed) return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [workspace, keyRow, isLoading]);

  const dismiss = (persist: boolean) => {
    if (persist && workspace && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_PREFIX + workspace.id, "1");
    }
    setOpen(false);
  };

  if (!workspace) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss(true)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </div>
            Unlock AI with your own key
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Aura's AI features run on{" "}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-2"
            >
              OpenRouter
            </a>{" "}
            — so you pay providers directly at cost, no per-seat markup.
          </p>

          <ul className="space-y-2.5 rounded-xl border border-border bg-muted/30 p-4">
            <li className="flex items-start gap-3 text-sm">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-500 ring-1 ring-violet-500/30">
                <Bot className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="font-medium leading-tight">AI agents</p>
                <p className="text-xs text-muted-foreground">
                  Assign virtual teammates to tasks
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-500 ring-1 ring-sky-500/30">
                <Mic className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="font-medium leading-tight">Meeting analysis</p>
                <p className="text-xs text-muted-foreground">
                  Summaries, decisions, and action items
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="font-medium leading-tight">Field auto-fill & insights</p>
                <p className="text-xs text-muted-foreground">
                  Across tables, boards, and notes
                </p>
              </div>
            </li>
          </ul>

          <div className="rounded-lg border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <KeyRound className="h-3.5 w-3.5" /> Two-minute setup
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-1">
              <li>
                Create a free account at{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  openrouter.ai/keys <ExternalLink className="inline h-3 w-3" />
                </a>
              </li>
              <li>Top up $5 — covers thousands of operations</li>
              <li>Paste the key in Settings → AI</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => dismiss(true)}>
            Maybe later
          </Button>
          <Button
            asChild
            onClick={() => dismiss(true)}
            className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
          >
            <Link to="/app/settings/ai">
              Add OpenRouter key
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
