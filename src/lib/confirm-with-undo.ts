import { toast } from "sonner";

interface UndoOptions {
  /** Window in ms during which the user can press Undo. Default 5000. */
  durationMs?: number;
  /** Optional id to dedupe stacked toasts. */
  id?: string;
}

/**
 * Optimistic destructive action with undo.
 *
 * Pattern:
 *  1. UI calls this immediately when the user clicks "Delete".
 *  2. We show a toast with an "Undo" button for `durationMs`.
 *  3. If the user clicks Undo, `onUndo()` is called and the action is cancelled.
 *  4. If the toast expires, `onCommit()` runs (the actual destructive write).
 *
 * Use this instead of confirm() dialogs for low-risk deletes (a row, a tag,
 * a comment). For high-risk ops (workspace, billing) keep the modal confirm.
 */
export function confirmWithUndo(
  message: string,
  onCommit: () => Promise<void> | void,
  onUndo?: () => void,
  opts: UndoOptions = {},
) {
  const duration = opts.durationMs ?? 5000;
  let undone = false;

  toast(message, {
    id: opts.id,
    duration,
    action: {
      label: "Undo",
      onClick: () => {
        undone = true;
        onUndo?.();
      },
    },
  });

  setTimeout(() => {
    if (undone) return;
    Promise.resolve(onCommit()).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Action failed");
    });
  }, duration);
}
