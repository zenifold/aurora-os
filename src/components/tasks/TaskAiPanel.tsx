import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAiAgents, useTaskAiAssignments, type AiTaskAssignment } from "@/hooks/use-ai";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { runAiAssignment } from "@/server/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, RotateCw, Check, AlertCircle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUpdateTask } from "@/hooks/use-tasks";
import type { Task } from "@/lib/types";

export function TaskAiPanel({ task }: { task: Task }) {
  const { data: agents = [] } = useAiAgents();
  const { data: assignments = [] } = useTaskAiAssignments(task.id);
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  const { user } = useAuth();
  const runFn = useServerFn(runAiAssignment);
  const updateTask = useUpdateTask(task.project_id);

  const [agentId, setAgentId] = useState<string>("");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeAgents = agents.filter((a) => a.is_active);

  const submit = async () => {
    if (!agentId || !workspaceId || !user) return;
    setSubmitting(true);
    try {
      const { data: row, error } = await supabase
        .from("ai_task_assignments")
        .insert({
          workspace_id: workspaceId,
          task_id: task.id,
          agent_id: agentId,
          instructions: instructions.trim() || null,
          created_by: user.id,
          status: "queued",
        })
        .select("id")
        .single();
      if (error) throw error;
      setInstructions("");
      // Fire & forget; status updates stream via realtime
      runFn({ data: { assignment_id: row.id } }).catch((err) => {
        toast.error(err instanceof Error ? err.message : "AI run failed");
      });
      toast.success("AI agent started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start AI");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async (a: AiTaskAssignment) => {
    try {
      await supabase
        .from("ai_task_assignments")
        .update({ status: "queued", error_message: null })
        .eq("id", a.id);
      runFn({ data: { assignment_id: a.id } }).catch((err) => {
        toast.error(err instanceof Error ? err.message : "AI run failed");
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const accept = async (a: AiTaskAssignment) => {
    if (!a.output) return;
    // Append to description as plain text paragraph
    const existing = task.description as unknown;
    const newPara = {
      type: "paragraph",
      content: [{ type: "text", text: a.output }],
    };
    const next =
      existing && typeof existing === "object" && "content" in (existing as object)
        ? {
            ...(existing as { type: string; content: unknown[] }),
            content: [
              ...((existing as { content: unknown[] }).content ?? []),
              newPara,
            ],
          }
        : { type: "doc", content: [newPara] };
    updateTask.mutate({ id: task.id, description: next as never });
    await supabase.from("ai_task_assignments").update({ status: "completed" }).eq("id", a.id);
    toast.success("AI output added to description");
  };

  const dismiss = async (a: AiTaskAssignment) => {
    await supabase.from("ai_task_assignments").delete().eq("id", a.id);
  };

  return (
    <div className="space-y-4">
      {/* Assign form */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Assign to AI agent</h3>
        </div>
        {activeAgents.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No active agents.{" "}
            <a href="/app/settings/ai" className="text-primary hover:underline">
              Create one in settings
            </a>
            .
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent…" />
              </SelectTrigger>
              <SelectContent>
                {activeAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="mr-2">{a.avatar_emoji ?? "🤖"}</span>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Optional instructions (e.g. 'Draft a 200-word summary')"
              rows={2}
            />
            <Button
              size="sm"
              disabled={!agentId || submitting}
              onClick={submit}
              className="bg-aura-gradient text-primary-foreground hover:opacity-90"
            >
              {submitting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Run agent
            </Button>
          </div>
        )}
      </div>

      {/* Assignment history / outputs */}
      {assignments.length > 0 && (
        <div className="space-y-3">
          {assignments.map((a) => {
            const agent = agents.find((g) => g.id === a.agent_id);
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{agent?.avatar_emoji ?? "🤖"}</span>
                    <div>
                      <p className="text-sm font-medium">{agent?.name ?? "AI agent"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                        {a.tokens_used != null && ` · ${a.tokens_used} tokens`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>

                {a.status === "running" && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                  </div>
                )}

                {a.error_message && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{a.error_message}</span>
                  </div>
                )}

                {a.output && (
                  <div className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">
                    {a.output}
                  </div>
                )}

                {(a.status === "review_needed" || a.status === "failed") && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.output && (
                      <Button size="sm" onClick={() => accept(a)}>
                        <Check className="mr-1.5 h-3.5 w-3.5" /> Add to description
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => retry(a)}>
                      <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => dismiss(a)}
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" /> Dismiss
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AiTaskAssignment["status"] }) {
  const map: Record<AiTaskAssignment["status"], { label: string; cls: string }> = {
    queued: { label: "Queued", cls: "bg-muted text-muted-foreground" },
    running: { label: "Running", cls: "bg-primary/10 text-primary" },
    review_needed: { label: "Review", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    failed: { label: "Failed", cls: "bg-destructive/10 text-destructive" },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status];
  return <Badge className={m.cls + " border-transparent"}>{m.label}</Badge>;
}
