import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUIStore } from "@/stores/ui-store";

type Row = { keys: string[]; desc: string };
type Group = { title: string; rows: Row[] };

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

const GROUPS: Group[] = [
  {
    title: "General",
    rows: [
      { keys: [mod, "K"], desc: "Open command palette" },
      { keys: [mod, "N"], desc: "Quick create" },
      { keys: [mod, "J"], desc: "Toggle Aura assistant" },
      { keys: ["?"], desc: "Page help" },
      { keys: [mod, "/"], desc: "Keyboard shortcuts" },
    ],
  },
  {
    title: "Go to (press g, then…)",
    rows: [
      { keys: ["G", "H"], desc: "Home" },
      { keys: ["G", "T"], desc: "My tasks" },
      { keys: ["G", "C"], desc: "CRM" },
      { keys: ["G", "L"], desc: "Clients" },
      { keys: ["G", "I"], desc: "Inbox" },
      { keys: ["G", "N"], desc: "Notes" },
      { keys: ["G", "M"], desc: "Meetings" },
      { keys: ["G", "A"], desc: "Agent runs" },
      { keys: ["G", "B"], desc: "Notifications" },
      { keys: ["G", "S"], desc: "Settings" },
    ],
  },
];

export function ShortcutsDialog() {
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Move faster with the keyboard.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.rows.map((r) => (
                  <li key={r.desc} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground/90">{r.desc}</span>
                    <span className="flex items-center gap-1">
                      {r.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
