import { useState } from "react";
import { Bot, Check, Loader2, Plus, Sparkles, Users, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useWorkspaceMembers } from "@/hooks/use-comments";
import { useAiAgents, useTaskAiAssignments } from "@/hooks/use-ai";
import { runAiAssignment } from "@/server/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AssigneePicker({
  value,
  onChange,
  taskId,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** When provided, AI agents can be assigned to this task. */
  taskId?: string;
}) {
  const { data: members = [], isLoading: membersLoading } = useWorkspaceMembers();
  const { data: agents = [] } = useAiAgents();
  const { data: aiAssignments = [] } = useTaskAiAssignments(taskId ?? "");
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  const { user } = useAuth();
  const runFn = useServerFn(runAiAssignment);
  const [open, setOpen] = useState(false);
  const [assigningAgentId, setAssigningAgentId] = useState<string | null>(null);

  const selected = members.filter((m) => value.includes(m.id));
  const activeAgents = agents.filter((a) => a.is_active);

  // Latest assignment per agent (so a single chip is shown per agent)
  const agentLatest = new Map<string, (typeof aiAssignments)[number]>();
  for (const a of aiAssignments) {
    const cur = agentLatest.get(a.agent_id);
    if (!cur || new Date(a.created_at) > new Date(cur.created_at))
      agentLatest.set(a.agent_id, a);
  }
  const agentChips = activeAgents
    .map((agent) => ({ agent, assignment: agentLatest.get(agent.id) }))
    .filter((x) => x.assignment && x.assignment.status !== "cancelled");

  const toggleMember = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const assignAgent = async (agentId: string) => {
    if (!taskId || !workspaceId || !user) {
      toast.error("Save the task before assigning an agent");
      return;
    }
    setAssigningAgentId(agentId);
    try {
      const { data: row, error } = await supabase
        .from("ai_task_assignments")
        .insert({
          workspace_id: workspaceId,
          task_id: taskId,
          agent_id: agentId,
          created_by: user.id,
          status: "queued",
        })
        .select("id")
        .single();
      if (error) throw error;
      runFn({ data: { assignment_id: row.id } }).catch((err) => {
        toast.error(err instanceof Error ? err.message : "AI run failed");
      });
      toast.success("AI agent assigned");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign agent");
    } finally {
      setAssigningAgentId(null);
    }
  };

  const unassignAgent = async (assignmentId: string) => {
    try {
      await supabase
        .from("ai_task_assignments")
        .update({ status: "cancelled" })
        .eq("id", assignmentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const empty = members.length === 0 && activeAgents.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Member chips */}
      {selected.map((m) => (
        <span
          key={m.id}
          className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-0.5 pl-0.5 pr-2 text-xs"
        >
          <Avatar className="h-5 w-5">
            <AvatarImage src={m.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {initials(m.display_name)}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[140px] truncate">
            {m.display_name ?? "Member"}
          </span>
          <button
            type="button"
            onClick={() => toggleMember(m.id)}
            className="opacity-0 transition group-hover:opacity-100"
            aria-label="Remove assignee"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {/* AI agent chips */}
      {agentChips.map(({ agent, assignment }) => {
        const status = assignment!.status;
        return (
          <span
            key={agent.id}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-1.5 pr-2 text-xs",
              "border-aura-purple/40 bg-aura-purple/10 text-aura-purple",
            )}
            title={`${agent.name} · ${status}`}
          >
            <span className="text-sm leading-none">{agent.avatar_emoji ?? "🤖"}</span>
            <span className="max-w-[140px] truncate font-medium">{agent.name}</span>
            {(status === "queued" || status === "running") && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {status === "completed" && <Check className="h-3 w-3" />}
            <button
              type="button"
              onClick={() => unassignAgent(assignment!.id)}
              className="opacity-0 transition group-hover:opacity-100"
              aria-label="Cancel agent"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            {selected.length === 0 && agentChips.length === 0 ? "Assign" : "Add"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search teammates or agents…" />
            <CommandList>
              <CommandEmpty>
                {membersLoading ? "Loading…" : empty ? "No teammates or agents." : "No matches."}
              </CommandEmpty>

              {members.length > 0 && (
                <CommandGroup
                  heading={
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Users className="h-3 w-3" /> Teammates
                    </span>
                  }
                >
                  {members.map((m) => {
                    const active = value.includes(m.id);
                    return (
                      <CommandItem
                        key={m.id}
                        value={`${m.display_name ?? ""} ${m.id}`}
                        onSelect={() => toggleMember(m.id)}
                        className="gap-2"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={m.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {initials(m.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">
                          {m.display_name ?? "Member"}
                        </span>
                        <Check
                          className={cn(
                            "h-4 w-4",
                            active ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {taskId && activeAgents.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup
                    heading={
                      <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <Sparkles className="h-3 w-3" /> AI agents
                      </span>
                    }
                  >
                    {activeAgents.map((agent) => {
                      const busy = assigningAgentId === agent.id;
                      const existing = agentLatest.get(agent.id);
                      const running =
                        existing &&
                        (existing.status === "queued" || existing.status === "running");
                      return (
                        <CommandItem
                          key={agent.id}
                          value={`agent ${agent.name}`}
                          disabled={busy || running}
                          onSelect={() => assignAgent(agent.id)}
                          className="gap-2"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aura-purple/15 text-sm">
                            {agent.avatar_emoji ?? "🤖"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{agent.name}</div>
                            {agent.description && (
                              <div className="truncate text-[11px] text-muted-foreground">
                                {agent.description}
                              </div>
                            )}
                          </div>
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : running ? (
                            <span className="text-[10px] text-muted-foreground">running</span>
                          ) : (
                            <Bot className="h-4 w-4 text-muted-foreground" />
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
