// Lightweight client error reporter — POSTs to error_reports via Supabase.
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

type Severity = "error" | "warning" | "info";

const RECENT: { key: string; at: number }[] = [];
const DEDUP_WINDOW_MS = 30_000;

function isDuplicate(key: string) {
  const now = Date.now();
  for (let i = RECENT.length - 1; i >= 0; i--) {
    if (now - RECENT[i].at > DEDUP_WINDOW_MS) RECENT.splice(i, 1);
  }
  if (RECENT.some((r) => r.key === key)) return true;
  RECENT.push({ key, at: now });
  if (RECENT.length > 50) RECENT.shift();
  return false;
}

export async function reportError(
  err: unknown,
  opts: { severity?: Severity; context?: Record<string, unknown> } = {}
) {
  try {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    const key = `${message}::${(stack ?? "").slice(0, 200)}`;
    if (isDuplicate(key)) return;

    const ws = useWorkspaceStore.getState().current;
    const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

    await supabase.from("error_reports").insert({
      workspace_id: ws?.id ?? null,
      user_id: userData?.user?.id ?? null,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000) ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      route: typeof window !== "undefined" ? window.location.pathname : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      severity: opts.severity ?? "error",
      context: (opts.context ?? {}) as never,
    });
  } catch {
    // never throw from the reporter
  }
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    void reportError(e.error ?? e.message, {
      context: { type: "window.error", filename: e.filename, lineno: e.lineno, colno: e.colno },
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    void reportError(e.reason, { context: { type: "unhandledrejection" } });
  });
}
