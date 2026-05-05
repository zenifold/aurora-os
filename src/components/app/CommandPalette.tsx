import { useUIStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  FolderTree,
  StickyNote,
  Layers,
  Plus,
  Inbox,
  Calendar,
  Users,
  Settings,
  Bell,
  Sparkles,
} from "lucide-react";

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const setQuickCaptureOpen = useUIStore((s) => s.setQuickCaptureOpen);
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();

  const { data: divisions = [] } = useQuery({
    queryKey: ["cmd-divisions", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("divisions")
        .select("id, name, slug, icon, color")
        .eq("workspace_id", ws!.id)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["cmd-folders", ws?.id],
    enabled: !!ws && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("folders")
        .select("id, name, color")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .limit(100);
      return data ?? [];
    },
  });

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

  const go = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 50);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to anything…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem value="action new task quick capture" onSelect={() => go(() => setQuickCaptureOpen(true))}>
            <Plus className="mr-2 h-4 w-4" /> Quick capture
          </CommandItem>
          <CommandItem value="action magic add ai" onSelect={() => go(() => setMagicAddOpen(true))}>
            <Sparkles className="mr-2 h-4 w-4" /> Magic add (AI)
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
          <CommandItem value="nav notes" onSelect={() => go(() => navigate({ to: "/app/notes" }))}>
            <StickyNote className="mr-2 h-4 w-4" /> Notes
          </CommandItem>
          <CommandItem value="nav meetings" onSelect={() => go(() => navigate({ to: "/app/meetings" }))}>
            <Calendar className="mr-2 h-4 w-4" /> Meetings
          </CommandItem>
          <CommandItem value="nav crm contacts" onSelect={() => go(() => navigate({ to: "/app/crm" }))}>
            <Users className="mr-2 h-4 w-4" /> CRM
          </CommandItem>
          <CommandItem value="nav notifications" onSelect={() => go(() => navigate({ to: "/app/notifications" }))}>
            <Bell className="mr-2 h-4 w-4" /> Notifications
          </CommandItem>
          <CommandItem value="nav settings" onSelect={() => go(() => navigate({ to: "/app/settings" }))}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </CommandItem>
        </CommandGroup>

        {divisions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Divisions">
              {divisions.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`division ${d.name}`}
                  onSelect={() =>
                    go(() => navigate({ to: "/app/d/$divisionSlug", params: { divisionSlug: d.slug } }))
                  }
                >
                  <Layers className="mr-2 h-4 w-4" style={{ color: d.color }} />
                  {d.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {folders.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Folders">
              {folders.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`folder ${f.name}`}
                  onSelect={() =>
                    go(() => navigate({ to: "/app/f/$folderId", params: { folderId: f.id } }))
                  }
                >
                  <FolderTree className="mr-2 h-4 w-4" style={{ color: f.color ?? undefined }} />
                  {f.name}
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
                  onSelect={() =>
                    go(() => navigate({ to: "/app/p/$projectId", params: { projectId: p.id } }))
                  }
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
                  onSelect={() =>
                    go(() => {
                      navigate({ to: "/app/p/$projectId", params: { projectId: t.project_id } });
                      setTimeout(() => setSelectedTaskId(t.id), 100);
                    })
                  }
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
                  onSelect={() => go(() => navigate({ to: "/app/notes" }))}
                >
                  <StickyNote className="mr-2 h-4 w-4 text-muted-foreground" />
                  {n.title || "Untitled"}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
