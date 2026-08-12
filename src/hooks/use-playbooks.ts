import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { ProjectPlaybook, PlaybookMilestone, PlaybookTask } from "@/lib/playbook-types";

export function usePlaybooks() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["playbooks", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_playbooks" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ProjectPlaybook[];
    },
  });
}

export function usePlaybook(playbookId: string | undefined) {
  return useQuery({
    queryKey: ["playbook", playbookId],
    enabled: !!playbookId,
    queryFn: async () => {
      const [pb, ms, ts] = await Promise.all([
        supabase.from("project_playbooks" as never).select("*").eq("id", playbookId!).single(),
        supabase
          .from("playbook_milestones" as never)
          .select("*")
          .eq("playbook_id", playbookId!)
          .order("order_index"),
        supabase
          .from("playbook_tasks" as never)
          .select("*")
          .eq("playbook_id", playbookId!)
          .order("order_index"),
      ]);
      if (pb.error) throw pb.error;
      return {
        playbook: pb.data as unknown as ProjectPlaybook,
        milestones: (ms.data ?? []) as unknown as PlaybookMilestone[],
        tasks: (ts.data ?? []) as unknown as PlaybookTask[],
      };
    },
  });
}

export function useCreatePlaybook() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ProjectPlaybook> & { name: string }) => {
      if (!ws) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("project_playbooks" as never)
        .insert({
          workspace_id: ws.id,
          created_by: user?.id ?? null,
          ...input,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectPlaybook;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbooks", ws?.id] });
      toast.success("Playbook created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePlaybook() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ProjectPlaybook> & { id: string }) => {
      const { error } = await supabase
        .from("project_playbooks" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["playbooks", ws?.id] });
      qc.invalidateQueries({ queryKey: ["playbook", vars.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePlaybook() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_playbooks" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbooks", ws?.id] });
      toast.success("Playbook deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertPlaybookMilestone() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PlaybookMilestone> & { playbook_id: string; name: string }) => {
      if (!ws) throw new Error("No workspace");
      const payload = { workspace_id: ws.id, ...input };
      if (input.id) {
        const { error } = await supabase
          .from("playbook_milestones" as never)
          .update(payload as never)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("playbook_milestones" as never)
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["playbook", vars.playbook_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePlaybookMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; playbook_id: string }) => {
      const { error } = await supabase
        .from("playbook_milestones" as never)
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["playbook", vars.playbook_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertPlaybookTask() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PlaybookTask> & { playbook_id: string; title: string }) => {
      if (!ws) throw new Error("No workspace");
      const payload = { workspace_id: ws.id, ...input };
      if (input.id) {
        const { error } = await supabase
          .from("playbook_tasks" as never)
          .update(payload as never)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("playbook_tasks" as never)
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["playbook", vars.playbook_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePlaybookTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; playbook_id: string }) => {
      const { error } = await supabase.from("playbook_tasks" as never).delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["playbook", vars.playbook_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Apply a playbook to an existing project: spawns milestones + tasks with
 * dates computed from the given start date plus each item's day_offset.
 */
export function useApplyPlaybook() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { playbook_id: string; project_id: string; start_date: string }) => {
      if (!ws || !user) throw new Error("Not signed in");

      const [{ data: pbRaw }, { data: msRaw }, { data: tsRaw }] = await Promise.all([
        supabase.from("project_playbooks" as never).select("*").eq("id", input.playbook_id).single(),
        supabase
          .from("playbook_milestones" as never)
          .select("*")
          .eq("playbook_id", input.playbook_id)
          .order("order_index"),
        supabase
          .from("playbook_tasks" as never)
          .select("*")
          .eq("playbook_id", input.playbook_id)
          .order("order_index"),
      ]);

      const pbMs = (msRaw ?? []) as unknown as PlaybookMilestone[];
      const pbTasks = (tsRaw ?? []) as unknown as PlaybookTask[];

      const start = new Date(input.start_date);
      const addDays = (n: number) => {
        const d = new Date(start);
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
      };

      // Map playbook milestone id -> created milestone id
      const msIdMap = new Map<string, string>();

      if (pbMs.length > 0) {
        const msRows = pbMs.map((m, i) => ({
          workspace_id: ws.id,
          project_id: input.project_id,
          name: m.name,
          description: m.description,
          milestone_type: m.milestone_type,
          target_date: addDays(m.day_offset),
          requires_signoff: m.requires_signoff,
          signoff_status: m.requires_signoff ? "pending" : "not_required",
          order_index: i,
          created_by: user.id,
        }));
        const { data: createdMs, error: msErr } = await supabase
          .from("milestones" as never)
          .insert(msRows as never)
          .select("id, name, order_index");
        if (msErr) throw msErr;
        const created = (createdMs ?? []) as unknown as Array<{ id: string; order_index: number }>;
        pbMs.forEach((src, i) => {
          const match = created.find((c) => c.order_index === i);
          if (match) msIdMap.set(src.id, match.id);
        });
      }

      if (pbTasks.length > 0) {
        // Get the highest existing position so new tasks land after them
        const { data: posRow } = await supabase
          .from("tasks")
          .select("position")
          .eq("project_id", input.project_id)
          .order("position", { ascending: false })
          .limit(1);
        const basePos = posRow && posRow.length > 0 ? Number(posRow[0].position) + 1000 : 0;

        const taskRows = pbTasks.map((t, i) => {
          const linkedMsId = t.playbook_milestone_id
            ? msIdMap.get(t.playbook_milestone_id) ?? null
            : null;
          const tags = [...(t.tags ?? [])];
          if (linkedMsId && !tags.some((x) => x.startsWith("milestone:"))) {
            tags.push(`milestone:${linkedMsId}`);
          }
          return {
            workspace_id: ws.id,
            project_id: input.project_id,
            title: t.title,
            description: t.description,
            status: "todo",
            priority: t.priority,
            task_type: t.task_type,
            start_date: t.day_offset_start != null ? addDays(t.day_offset_start) : null,
            due_date: t.day_offset_due != null ? addDays(t.day_offset_due) : null,
            tags,
            position: basePos + i * 100,
            created_by: user.id,
          };
        });
        const { error: tErr } = await supabase.from("tasks").insert(taskRows as never);
        if (tErr) throw tErr;
      }

      // Bump usage counter (best-effort)
      const currentCount = (pbRaw as unknown as ProjectPlaybook | null)?.usage_count ?? 0;
      await supabase
        .from("project_playbooks" as never)
        .update({ usage_count: currentCount + 1 } as never)
        .eq("id", input.playbook_id);

      return { milestonesCreated: pbMs.length, tasksCreated: pbTasks.length };
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["milestones", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["tasks", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["playbooks", ws?.id] });
      toast.success(
        `Playbook applied · ${res.milestonesCreated} milestone${res.milestonesCreated === 1 ? "" : "s"} · ${res.tasksCreated} task${res.tasksCreated === 1 ? "" : "s"}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
