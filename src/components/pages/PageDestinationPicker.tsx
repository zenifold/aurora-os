import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, FolderIcon, FileText, ListTodo, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProjects } from "@/hooks/use-projects";
import { useFolders } from "@/hooks/use-folders";
import { usePages } from "@/hooks/use-pages";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { PageScope } from "@/lib/page-types";

export interface PageDestination {
  scope: PageScope;
  scope_id: string | null;
  parent_page_id: string | null;
  label: string;
}

const WORKSPACE_DEST: PageDestination = {
  scope: "workspace",
  scope_id: null,
  parent_page_id: null,
  label: "Workspace (top level)",
};

interface Props {
  value: PageDestination;
  onChange: (d: PageDestination) => void;
}

export function PageDestinationPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ws = useWorkspaceStore((s) => s.current);
  const { data: projects = [] } = useProjects();
  const { data: folders = [] } = useFolders();
  const { data: pages = [] } = usePages({ archived: false });

  const taskQuery = useQuery({
    queryKey: ["page-dest-tasks", ws?.id, query],
    enabled: !!ws && open,
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("id,title,project_id")
        .eq("workspace_id", ws!.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const ql = query.trim().toLowerCase();
  const filteredProjects = useMemo(
    () => (ql ? projects.filter((p) => p.name.toLowerCase().includes(ql)) : projects).slice(0, 12),
    [projects, ql],
  );
  const filteredFolders = useMemo(
    () => (ql ? folders.filter((f) => f.name.toLowerCase().includes(ql)) : folders).slice(0, 12),
    [folders, ql],
  );
  const filteredPages = useMemo(
    () =>
      (ql ? pages.filter((p) => p.title.toLowerCase().includes(ql)) : pages)
        .filter((p) => p.page_type === "folder" || p.scope === "workspace")
        .slice(0, 12),
    [pages, ql],
  );

  const select = (d: PageDestination) => {
    onChange(d);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="flex min-w-0 items-center gap-2">
            <DestIcon scope={value.scope} />
            <span className="truncate">{value.label}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search projects, folders, pages, tasks…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="General">
              <Item
                active={value.scope === "workspace" && !value.scope_id}
                onSelect={() => select(WORKSPACE_DEST)}
                icon={<Globe className="h-4 w-4" />}
                label="Workspace (top level)"
              />
            </CommandGroup>
            {filteredProjects.length > 0 && (
              <CommandGroup heading="Projects">
                {filteredProjects.map((p) => (
                  <Item
                    key={p.id}
                    active={value.scope === "project" && value.scope_id === p.id}
                    onSelect={() =>
                      select({ scope: "project", scope_id: p.id, parent_page_id: null, label: `Project · ${p.name}` })
                    }
                    icon={<span className="h-3 w-3 rounded-sm" style={{ background: p.color ?? "hsl(var(--primary))" }} />}
                    label={p.name}
                  />
                ))}
              </CommandGroup>
            )}
            {false && filteredFolders.length > 0 && null}

            {filteredPages.length > 0 && (
              <CommandGroup heading="Inside a page / section">
                {filteredPages.map((p) => (
                  <Item
                    key={p.id}
                    active={value.parent_page_id === p.id}
                    onSelect={() =>
                      select({
                        scope: p.scope,
                        scope_id: p.scope_id,
                        parent_page_id: p.id,
                        label: `Inside ${p.icon ?? "📄"} ${p.title}`,
                      })
                    }
                    icon={<span className="text-base leading-none">{p.icon ?? "📄"}</span>}
                    label={p.title}
                  />
                ))}
              </CommandGroup>
            )}
            {(taskQuery.data?.length ?? 0) > 0 && (
              <CommandGroup heading="Tasks">
                {(taskQuery.data ?? []).map((t) => (
                  <Item
                    key={t.id}
                    active={value.scope === "task" && value.scope_id === t.id}
                    onSelect={() =>
                      select({ scope: "task", scope_id: t.id, parent_page_id: null, label: `Task · ${t.title}` })
                    }
                    icon={<ListTodo className="h-4 w-4" />}
                    label={t.title}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Item({
  active,
  onSelect,
  icon,
  label,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <CommandItem onSelect={onSelect} className="gap-2">
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {active && <Check className="h-4 w-4 text-primary" />}
    </CommandItem>
  );
}

function DestIcon({ scope }: { scope: PageScope }) {
  switch (scope) {
    case "project":
      return <span className="h-3 w-3 rounded-sm bg-primary" />;
    case "folder":
      return <FolderIcon className="h-4 w-4" />;
    case "task":
      return <ListTodo className="h-4 w-4" />;
    case "contact":
      return <FileText className="h-4 w-4" />;
    default:
      return <Globe className="h-4 w-4" />;
  }
}

export const DEFAULT_PAGE_DESTINATION = WORKSPACE_DEST;

// Avoid unused-import warning for cn
void cn;
