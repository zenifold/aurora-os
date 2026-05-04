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
} from "@/components/ui/command";
import { Folder, CheckSquare } from "lucide-react";

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const ws = useWorkspaceStore((s) => s.current);
  const navigate = useNavigate();

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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search projects and tasks…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem
                key={p.id}
                value={`project ${p.name}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: "/app/p/$projectId", params: { projectId: p.id } });
                }}
              >
                <Folder className="mr-2 h-4 w-4" style={{ color: p.color }} />
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {tasks.map((t) => (
              <CommandItem
                key={t.id}
                value={`task ${t.title}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: "/app/p/$projectId", params: { projectId: t.project_id } });
                  setTimeout(() => setSelectedTaskId(t.id), 100);
                }}
              >
                <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                {t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
