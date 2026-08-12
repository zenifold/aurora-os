import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * In-app replacements for window.confirm / window.alert / window.prompt.
 *
 * Usage:
 *   if (await confirmDialog({ title: "Delete?", description: "...", tone: "destructive" })) { ... }
 *   const name = await promptDialog({ title: "Rename", defaultValue: page.title });
 *   await alertDialog({ title: "Saved" });
 *
 * A single host (<DialogsHost />) is mounted at the root and listens for events.
 */

// ---------- Types ----------
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
}

export interface AlertOptions {
  title: string;
  description?: string;
  okLabel?: string;
}

export interface PromptOptions {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  required?: boolean;
}

// ---------- Event bus ----------
type Pending =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "alert"; opts: AlertOptions; resolve: () => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };

type Listener = (p: Pending) => void;
const listeners = new Set<Listener>();

function emit(p: Pending) {
  if (listeners.size === 0) {
    // Fallback: no host mounted (e.g. SSR). Use sane defaults so flows don't hang.
    if (p.kind === "confirm") (p as Extract<Pending, { kind: "confirm" }>).resolve(false);
    else if (p.kind === "alert") (p as Extract<Pending, { kind: "alert" }>).resolve();
    else (p as Extract<Pending, { kind: "prompt" }>).resolve(null);
    return;
  }
  listeners.forEach((l) => l(p));
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => emit({ kind: "confirm", opts, resolve }));
}

export function alertDialog(opts: AlertOptions): Promise<void> {
  return new Promise((resolve) => emit({ kind: "alert", opts, resolve }));
}

export function promptDialog(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => emit({ kind: "prompt", opts, resolve }));
}

// ---------- Host ----------
type ActiveConfirm = { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void };
type ActiveAlert = { kind: "alert"; opts: AlertOptions; resolve: () => void };
type ActivePrompt = { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };
type Active = ActiveConfirm | ActiveAlert | ActivePrompt | null;

export function DialogsHost() {
  const [active, setActive] = useState<Active>(null);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    const listener: Listener = (p) => {
      setQueue((q) => [...q, p]);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Pull next from queue when idle.
  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next);
    if (next.kind === "prompt") setPromptValue(next.opts.defaultValue ?? "");
  }, [active, queue]);

  const close = () => setActive(null);

  // Confirm
  if (active?.kind === "confirm") {
    const { opts, resolve } = active;
    return (
      <AlertDialog
        open
        onOpenChange={(o) => {
          if (!o) {
            resolve(false);
            close();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts.title}</AlertDialogTitle>
            {opts.description && (
              <AlertDialogDescription className="whitespace-pre-line">
                {opts.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                resolve(false);
                close();
              }}
            >
              {opts.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                opts.tone === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={() => {
                resolve(true);
                close();
              }}
            >
              {opts.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Alert
  if (active?.kind === "alert") {
    const { opts, resolve } = active;
    return (
      <AlertDialog
        open
        onOpenChange={(o) => {
          if (!o) {
            resolve();
            close();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts.title}</AlertDialogTitle>
            {opts.description && (
              <AlertDialogDescription className="whitespace-pre-line">
                {opts.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                resolve();
                close();
              }}
            >
              {opts.okLabel ?? "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Prompt
  if (active?.kind === "prompt") {
    const { opts, resolve } = active;
    const submit = () => {
      if (opts.required && !promptValue.trim()) return;
      resolve(promptValue);
      close();
    };
    const cancel = () => {
      resolve(null);
      close();
    };
    return (
      <Dialog
        open
        onOpenChange={(o) => {
          if (!o) cancel();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{opts.title}</DialogTitle>
            {opts.description && (
              <DialogDescription className="whitespace-pre-line">
                {opts.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="py-2">
            {opts.multiline ? (
              <Textarea
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={opts.placeholder}
                rows={4}
              />
            ) : (
              <Input
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={opts.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={cancel}>
              {opts.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              onClick={submit}
              disabled={opts.required && !promptValue.trim()}
            >
              {opts.confirmLabel ?? "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
