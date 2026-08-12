import { createFileRoute } from "@tanstack/react-router";
import { Keyboard } from "lucide-react";

export const Route = createFileRoute("/app/settings/shortcuts")({
  component: ShortcutsPage,
});

type Shortcut = { keys: string; desc: string };
type Group = { title: string; items: Shortcut[] };

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

const GROUPS: Group[] = [
  {
    title: "Global",
    items: [
      { keys: `${mod} K`, desc: "Open search & command palette" },
      { keys: `${mod} N`, desc: "Quick create (task, project, note…)" },
      { keys: `${mod} J`, desc: "Toggle Aura AI panel" },
      { keys: "?", desc: "Open page-aware help" },
      { keys: "Esc", desc: "Close open panel or dialog" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { keys: "G then H", desc: "Go to Home" },
      { keys: "G then I", desc: "Go to Inbox" },
      { keys: "G then T", desc: "Go to My tasks" },
      { keys: "G then P", desc: "Go to Projects" },
      { keys: "G then M", desc: "Go to Meetings" },
    ],
  },
  {
    title: "Editing",
    items: [
      { keys: "Enter", desc: "Save current input / submit" },
      { keys: "Shift Enter", desc: "New line in text fields" },
      { keys: `${mod} Enter`, desc: "Confirm dialog primary action" },
      { keys: `${mod} Z`, desc: "Undo last change" },
    ],
  },
];

function ShortcutsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
          Keyboard shortcuts
        </h2>
        <p className="text-sm text-muted-foreground">
          Move faster across Aurora without touching the mouse.
        </p>
      </div>

      <div className="space-y-6">
        {GROUPS.map((g) => (
          <section key={g.title} className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {g.title}
            </div>
            <ul className="divide-y divide-border">
              {g.items.map((s) => (
                <li
                  key={s.keys}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                >
                  <span className="text-foreground/90">{s.desc}</span>
                  <kbd className="rounded border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
                    {s.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Per-page shortcuts also appear in the help panel — press{" "}
        <kbd className="rounded border bg-background px-1 font-mono">?</kbd> on any page.
      </p>
    </div>
  );
}
