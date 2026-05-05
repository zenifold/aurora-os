import { useState } from "react";
import { useBulkUpdateTasks } from "@/hooks/use-tasks";
import { useProjectWorkflow, DEFAULT_WORKFLOW } from "@/hooks/use-project-workflow";
import { useWorkspaceMembers } from "@/hooks/use-comments";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  Flag,
  Loader2,
  Trash2,
  UserPlus,
  X,
  ChevronDown,
} from "lucide-react";
import { PRIORITY_OPTIONS, type TaskPriority } from "@/lib/types";
import { toast } from "sonner";

function initials(n?: string | null) {
  if (!n) return "?";
  return n.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

interface Props {
  projectId: string;
  selected: Set<string>;
  onClear: () => void;
}

/**
 * Floating bulk action bar — used by Table and Kanban views.
 * Positioned fixed at the bottom-center of the viewport when any tasks are selected.
 */
export function BulkActionBar({ projectId, selected, onClear }: Props) {
  const bulk = useBulkUpdateTasks(projectId);
  const { data: workflow = DEFAULT_WORKFLOW } = useProjectWorkflow(projectId);
  const { data: members = [] } = useWorkspaceMembers();
  const [busy, setBusy] = useState(false);

  if (selected.size === 0) return null;
  const ids = Array.from(selected);

  const setStatus = (status: string) =>
    bulk.mutate({ ids, patch: { status } }, { onSuccess: onClear });
  const setPriority = (priority: TaskPriority) =>
    bulk.mutate({ ids, patch: { priority } }, { onSuccess: onClear });

  const assign = async (mode: "set" | "add", userId: string) => {
    setBusy(true);
    try {
      // Fetch current assignees to support add semantics
      if (mode === "add") {
        const { data: rows } = await supabase
          .from("tasks")
          .select("id, assignee_ids")
          .in("id", ids);
        await Promise.all(
          (rows ?? []).map((r) => {
            const next = Array.from(new Set([...(r.assignee_ids ?? []), userId]));
            return supabase.from("tasks").update({ assignee_ids: next }).eq("id", r.id);
          }),
        );
        toast.success(`Added assignee to ${ids.length} task${ids.length === 1 ? "" : "s"}`);
      } else {
        await supabase.from("tasks").update({ assignee_ids: [userId] }).in("id", ids);
        toast.success(`Assigned ${ids.length} task${ids.length === 1 ? "" : "s"}`);
      }
      onClear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const clearAssignees = async () => {
    setBusy(true);
    try {
      await supabase.from("tasks").update({ assignee_ids: [] }).in("id", ids);
      toast.success("Cleared assignees");
      onClear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!confirm(`Delete ${ids.length} task${ids.length === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    Promise.all(ids.map((id) => supabase.from("tasks").delete().eq("id", id)))
      .then(() => {
        toast.success(`Deleted ${ids.length} tasks`);
        onClear();
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1.5 shadow-pop backdrop-blur">
        <span className="rounded-full bg-aura-gradient px-3 py-1 text-xs font-semibold text-primary-foreground">
          {selected.size} selected
        </span>

        {/* Status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-full px-2.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Status <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            {workflow.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => setStatus(s.id)}>
                <span
                  className="mr-2 h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-full px-2.5 text-xs">
              <Flag className="h-3.5 w-3.5" /> Priority <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-44">
            {PRIORITY_OPTIONS.map((p) => (
              <DropdownMenuItem key={p.value} onClick={() => setPriority(p.value)}>
                <span
                  className="mr-2 h-1.5 w-3 rounded-full"
                  style={{ background: p.color }}
                />
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assignee */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-full px-2.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" /> Assign <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Add or replace assignee…" />
              <CommandList>
                <CommandEmpty>No teammates.</CommandEmpty>
                <CommandGroup heading="Add to selection">
                  {members.map((m) => (
                    <CommandItem
                      key={`add-${m.id}`}
                      value={`add ${m.display_name ?? ""} ${m.id}`}
                      onSelect={() => assign("add", m.id)}
                      className="gap-2"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(m.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{m.display_name ?? "Member"}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup heading="Replace">
                  {members.map((m) => (
                    <CommandItem
                      key={`set-${m.id}`}
                      value={`set ${m.display_name ?? ""} ${m.id}`}
                      onSelect={() => assign("set", m.id)}
                      className="gap-2"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(m.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-muted-foreground">
                        Only {m.display_name ?? "Member"}
                      </span>
                    </CommandItem>
                  ))}
                  <CommandItem onSelect={clearAssignees} className="text-muted-foreground">
                    <X className="mr-2 h-3.5 w-3.5" /> Clear all assignees
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="mx-1 h-5 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded-full px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={remove}
          disabled={busy}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onClear}
          aria-label="Clear selection"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
