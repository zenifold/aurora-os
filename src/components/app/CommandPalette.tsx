import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { getRecents, pushRecent, type RecentItem } from "@/lib/recents";
import { useSavedViews } from "@/hooks/use-saved-views";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Folder,
  CheckSquare,
  StickyNote,
  Layers,
  Plus,
  Inbox,
  Calendar,
  Users,
  Settings,
  Bell,
  Sparkles,
  Clock,
  User,
  FileText,
  Keyboard,
  Briefcase,
  Building2,
  Bookmark,
} from "lucide-react";

const RECENT_ICONS = {
  task: CheckSquare,
  project: Folder,
  note: StickyNote,
  page: FileText,
  folder: Folder,
  contact: User,
  division: Layers,
  nav: Inbox,
} as const;


export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const setQuickCaptureOpen = useUIStore((s) => s.setQuickCaptureOpen);
  const setQuickCreateOpen = useUIStore((s) => s.setQuickCreateOpen);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const setAuraOpen = useUIStore((s) => s.setAuraOpen);
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();

  const divisions: Array<{ id: string; name: string; slug: string; icon?: string | null; color?: string }> = [];

  const folders: Array<{ id: string; name: string; color: string | null }> = [];


  const { data: projects = [] } = useQuery({
    queryKey: ["cmd-projects", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, color")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false);
      return data ?? [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["cmd-tasks", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, project_id")
        .eq("workspace_id", ws!.id)
        .limit(50)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["cmd-notes", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("id, title")
        .eq("workspace_id", ws!.id)
        .limit(30)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["cmd-pages", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pages")
        .select("id, title")
        .eq("workspace_id", ws!.id)
        .limit(30)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["cmd-contacts", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("workspace_id", ws!.id)
        .limit(30)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["cmd-deals", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, title, client_account_id")
        .eq("workspace_id", ws!.id)
        .in("status", ["open", "won"])
        .limit(30)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: savedViews = [] } = useSavedViews();



  const [recents, setRecents] = useState<RecentItem[]>([]);
  useEffect(() => {
    if (open) setRecents(getRecents(ws?.id));
  }, [open, ws?.id]);

  const go = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 50);
  };

  const openRecent = (r: RecentItem) => {
    pushRecent(ws?.id, { kind: r.kind, id: r.id, label: r.label, meta: r.meta });
    if (r.kind === "task" && r.meta?.project_id) {
      go(() => {
        navigate({ to: "/app/p/$projectId", params: { projectId: r.meta!.project_id! } });
        setTimeout(() => setSelectedTaskId(r.id), 100);
      });
    } else if (r.kind === "project") {
      go(() => navigate({ to: "/app/p/$projectId", params: { projectId: r.id } }));
    } else if (r.kind === "folder") {
      go(() => navigate({ to: "/app/clients" }));

    } else if (r.kind === "division") {
      // legacy — divisions removed

    } else if (r.kind === "note") {
      go(() => navigate({ to: "/app/notes", search: { archived: false, project: undefined } }));
    } else if (r.kind === "page") {
      go(() => navigate({ to: "/app/pages" }));
    } else if (r.kind === "contact") {
      go(() => navigate({ to: "/app/clients" }));
    }
  };

  const remember = (item: Omit<RecentItem, "ts">) => pushRecent(ws?.id, item);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to anything…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {recents.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recents.map((r) => {
                const Icon = RECENT_ICONS[r.kind] ?? Clock;
                return (
                  <CommandItem
                    key={`recent:${r.kind}:${r.id}`}
                    value={`recent ${r.label}`}
                    onSelect={() => openRecent(r)}
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{r.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground capitalize">{r.kind}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Actions">
          <CommandItem value="action ask aura ai assistant" onSelect={() => go(() => setAuraOpen(true))}>
            <Sparkles className="mr-2 h-4 w-4 text-primary" /> Ask Aura
          </CommandItem>
          <CommandItem value="action new task quick capture" onSelect={() => go(() => setQuickCaptureOpen(true))}>
            <Plus className="mr-2 h-4 w-4" /> Quick capture
          </CommandItem>
          <CommandItem value="action quick create new" onSelect={() => go(() => setQuickCreateOpen(true))}>
            <Sparkles className="mr-2 h-4 w-4" /> Quick create…
          </CommandItem>
          <CommandItem value="action keyboard shortcuts help" onSelect={() => go(() => setShortcutsOpen(true))}>
            <Keyboard className="mr-2 h-4 w-4" /> Keyboard shortcuts
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          <CommandItem value="nav home" onSelect={() => go(() => navigate({ to: "/app" }))}>
            <Inbox className="mr-2 h-4 w-4" /> Home
          </CommandItem>
          <CommandItem value="nav my tasks" onSelect={() => go(() => navigate({ to: "/app/my-tasks" }))}>
            <CheckSquare className="mr-2 h-4 w-4" /> My tasks
          </CommandItem>
          <CommandItem value="nav notes" onSelect={() => go(() => navigate({ to: "/app/notes", search: { archived: false, project: undefined } }))}>
            <StickyNote className="mr-2 h-4 w-4" /> Notes
          </CommandItem>
          <CommandItem value="nav meetings" onSelect={() => go(() => navigate({ to: "/app/meetings" }))}>
            <Calendar className="mr-2 h-4 w-4" /> Meetings
          </CommandItem>
          <CommandItem value="nav crm contacts" onSelect={() => go(() => navigate({ to: "/app/clients" }))}>
            <Users className="mr-2 h-4 w-4" /> CRM
          </CommandItem>
          <CommandItem value="nav agent runs ai" onSelect={() => go(() => navigate({ to: "/app/agent-runs" }))}>
            <Sparkles className="mr-2 h-4 w-4" /> Agent runs
          </CommandItem>
          <CommandItem value="nav notifications" onSelect={() => go(() => navigate({ to: "/app/inbox" }))}>
            <Bell className="mr-2 h-4 w-4" /> Notifications
          </CommandItem>
          <CommandItem value="nav settings" onSelect={() => go(() => navigate({ to: "/app/settings" }))}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </CommandItem>
        </CommandGroup>

        {false && divisions.length > 0 && null}

        {false && folders.length > 0 && null}



        {savedViews.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Saved views">
              {savedViews.slice(0, 8).map((v) => (
                <CommandItem
                  key={`view:${v.id}`}
                  value={`view saved ${v.name}`}
                  onSelect={() => go(() => navigate({ to: "/app/my-tasks", search: { view: v.id } as never }))}
                >
                  <Bookmark className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{v.name}</span>
                  {v.is_pinned && <span className="ml-auto text-xs text-muted-foreground">Pinned</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.name}`}
                  onSelect={() => {
                    remember({ kind: "project", id: p.id, label: p.name });
                    go(() => navigate({ to: "/app/p/$projectId", params: { projectId: p.id } }));
                  }}
                >
                  <Folder className="mr-2 h-4 w-4" style={{ color: p.color }} />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {tasks.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`task ${t.title}`}
                  onSelect={() => {
                    remember({ kind: "task", id: t.id, label: t.title, meta: { project_id: t.project_id } });
                    go(() => {
                      navigate({ to: "/app/p/$projectId", params: { projectId: t.project_id } });
                      setTimeout(() => setSelectedTaskId(t.id), 100);
                    });
                  }}
                >
                  <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                  {t.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {notes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notes">
              {notes.map((n) => (
                <CommandItem
                  key={n.id}
                  value={`note ${n.title}`}
                  onSelect={() => {
                    remember({ kind: "note", id: n.id, label: n.title || "Untitled" });
                    go(() => navigate({ to: "/app/notes", search: { archived: false, project: undefined } }));
                  }}
                >
                  <StickyNote className="mr-2 h-4 w-4 text-muted-foreground" />
                  {n.title || "Untitled"}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {pages.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {pages.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`page ${p.title}`}
                  onSelect={() => {
                    remember({ kind: "page", id: p.id, label: p.title || "Untitled" });
                    go(() => navigate({ to: "/app/pages" }));
                  }}
                >
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  {p.title || "Untitled"}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {deals.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Deals">
              {deals.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`deal opportunity ${d.title}`}
                  onSelect={() => {
                    if (d.client_account_id) {
                      go(() =>
                        navigate({
                          to: "/app/clients/$accountId/deal/$dealId",
                          params: { accountId: d.client_account_id!, dealId: d.id },
                        }),
                      );
                    } else {
                      go(() => navigate({ to: "/app/clients" }));
                    }
                  }}
                >
                  <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                  {d.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {contacts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contacts">
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`contact person ${c.name}`}
                  onSelect={() => {
                    remember({ kind: "contact", id: c.id, label: c.name });
                    go(() => navigate({ to: "/app/clients" }));
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
