import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  generateProjectPlan,
  type MagicPlanMilestone,
  type MagicPlanTask,
} from "@/server/magic-plan.functions";

export interface MagicPlan {
  summary: string;
  milestones: MagicPlanMilestone[];
  tasks: MagicPlanTask[];
}

export function useGenerateMagicPlan() {
  const ws = useWorkspaceStore((s) => s.current);
  const generate = useServerFn(generateProjectPlan);
  return useMutation({
    mutationFn: async (input: { prompt: string; duration_days: number; playbook_id?: string | null }) => {
      if (!ws) throw new Error("No workspace");
      const res = await generate({
        data: {
          workspace_id: ws.id,
          prompt: input.prompt,
          duration_days: input.duration_days,
          playbook_id: input.playbook_id ?? null,
        },
      });
      if (!res.ok) throw new Error(res.error);
      return res.plan;
    },
  });
}

/** Persist a (possibly edited) magic plan onto a project. */
export function useApplyMagicPlan() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      start_date: string;
      plan: MagicPlan;
    }) => {
      if (!ws || !user) throw new Error("Not signed in");

      const start = new Date(input.start_date);
      const addDays = (n: number) => {
        const d = new Date(start);
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
      };

      // Insert milestones first, in order
      const msRows = input.plan.milestones.map((m, i) => ({
        workspace_id: ws.id,
        project_id: input.project_id,
        name: m.name,
        description: m.description ?? null,
        milestone_type: m.milestone_type,
        target_date: addDays(m.day_offset),
        requires_signoff: m.requires_signoff,
        signoff_status: m.requires_signoff ? "pending" : "not_required",
        order_index: i,
        created_by: user.id,
      }));

      const idMap = new Map<number, string>();
      if (msRows.length > 0) {
        const { data: created, error } = await supabase
          .from("milestones" as never)
          .insert(msRows as never)
          .select("id, order_index");
        if (error) throw error;
        const list = (created ?? []) as unknown as Array<{ id: string; order_index: number }>;
        list.forEach((c) => idMap.set(c.order_index, c.id));
      }

      // Compute base position for tasks
      const { data: posRow } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", input.project_id)
        .order("position", { ascending: false })
        .limit(1);
      const basePos = posRow && posRow.length > 0 ? Number(posRow[0].position) + 1000 : 0;

      const taskRows = input.plan.tasks.map((t, i) => {
        const linkedMsId =
          t.milestone_index != null ? idMap.get(t.milestone_index) ?? null : null;
        const tags: string[] = [];
        if (t.is_customer_task) tags.push("customer");
        if (t.assignee_role_hint) tags.push(`role:${t.assignee_role_hint}`);
        if (linkedMsId) tags.push(`milestone:${linkedMsId}`);
        return {
          workspace_id: ws.id,
          project_id: input.project_id,
          title: t.title,
          description: t.description ?? null,
          status: "todo",
          priority: t.priority,
          task_type: "task",
          start_date: t.day_offset_start != null ? addDays(t.day_offset_start) : null,
          due_date: t.day_offset_due != null ? addDays(t.day_offset_due) : null,
          tags,
          position: basePos + i * 100,
          created_by: user.id,
        };
      });

      if (taskRows.length > 0) {
        const { error: tErr } = await supabase.from("tasks").insert(taskRows as never);
        if (tErr) throw tErr;
      }

      return { milestones: msRows.length, tasks: taskRows.length };
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["milestones", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["tasks", vars.project_id] });
      toast.success(`Magic Plan applied · ${res.milestones} milestones · ${res.tasks} tasks`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
