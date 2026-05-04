import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TaskRelation, RelationType, Task } from "@/lib/types";
import { toast } from "sonner";

const relationsKey = (taskId: string) => ["task-relations", taskId];
const projectRelationsKey = (projectId: string) => ["project-relations", projectId];

/**
 * Fetch all relations where this task is either source OR target.
 * Returns combined list along with the linked tasks (titles, status).
 */
export function useTaskRelations(taskId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: relationsKey(taskId ?? ""),
    enabled: !!taskId,
    queryFn: async () => {
      const { data: rels, error } = await supabase
        .from("task_relations")
        .select("*")
        .or(`source_task_id.eq.${taskId},target_task_id.eq.${taskId}`);
      if (error) throw error;
      const list = (rels ?? []) as TaskRelation[];

      // Fetch linked tasks in one batch
      const ids = Array.from(
        new Set(
          list.flatMap((r) => [r.source_task_id, r.target_task_id]).filter((id) => id !== taskId),
        ),
      );
      let tasks: Pick<Task, "id" | "title" | "status" | "project_id">[] = [];
      if (ids.length > 0) {
        const { data: ts, error: tErr } = await supabase
          .from("tasks")
          .select("id, title, status, project_id")
          .in("id", ids);
        if (tErr) throw tErr;
        tasks = (ts ?? []) as typeof tasks;
      }
      const tMap = new Map(tasks.map((t) => [t.id, t]));
      return list.map((r) => {
        const isOutgoing = r.source_task_id === taskId;
        const otherId = isOutgoing ? r.target_task_id : r.source_task_id;
        return { ...r, isOutgoing, other: tMap.get(otherId) ?? null };
      });
    },
  });

  // Realtime: refresh when relations involving this task change
  useEffect(() => {
    if (!taskId) return;
    const ch = supabase
      .channel(`task-relations:${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_relations" },
        (payload) => {
          const row = (payload.new ?? payload.old) as TaskRelation;
          if (row?.source_task_id === taskId || row?.target_task_id === taskId) {
            qc.invalidateQueries({ queryKey: relationsKey(taskId) });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [taskId, qc]);

  return query;
}

/**
 * Fetch all relations for tasks in a project (used for indicators in Table/Kanban).
 * Returns a Map<taskId, { blockedByOpen: number; blockingOpen: number }>.
 */
export function useProjectRelationIndicators(projectId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: projectRelationsKey(projectId ?? ""),
    enabled: !!projectId,
    queryFn: async () => {
      // Get all task ids in this project
      const { data: ts, error: tErr } = await supabase
        .from("tasks")
        .select("id, status")
        .eq("project_id", projectId!);
      if (tErr) throw tErr;
      const tasks = (ts ?? []) as { id: string; status: string }[];
      const ids = tasks.map((t) => t.id);
      if (ids.length === 0) return new Map<string, { blockedBy: number; blocking: number }>();

      // Pull blocks/blocked_by relations touching these tasks
      const { data: rels, error: rErr } = await supabase
        .from("task_relations")
        .select("source_task_id, target_task_id, relation_type")
        .in("relation_type", ["blocks", "blocked_by"])
        .or(`source_task_id.in.(${ids.join(",")}),target_task_id.in.(${ids.join(",")})`);
      if (rErr) throw rErr;

      const statusMap = new Map(tasks.map((t) => [t.id, t.status]));
      const indicators = new Map<string, { blockedBy: number; blocking: number }>();
      const bump = (id: string, key: "blockedBy" | "blocking") => {
        const cur = indicators.get(id) ?? { blockedBy: 0, blocking: 0 };
        cur[key] += 1;
        indicators.set(id, cur);
      };

      for (const r of (rels ?? []) as { source_task_id: string; target_task_id: string; relation_type: RelationType }[]) {
        // Normalize: treat "blocked_by" as inverse of "blocks"
        let blocker = r.source_task_id;
        let blocked = r.target_task_id;
        if (r.relation_type === "blocked_by") {
          blocker = r.target_task_id;
          blocked = r.source_task_id;
        }
        const blockerStatus = statusMap.get(blocker);
        // Only count if blocker is not done
        if (blockerStatus && blockerStatus !== "done" && blockerStatus !== "cancelled") {
          if (statusMap.has(blocked)) bump(blocked, "blockedBy");
          if (statusMap.has(blocker)) bump(blocker, "blocking");
        }
      }
      return indicators;
    },
  });

  // Realtime invalidation
  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`project-relations:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_relations" },
        () => qc.invalidateQueries({ queryKey: projectRelationsKey(projectId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, qc]);

  return query;
}

interface CreateRelationInput {
  workspaceId: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationType: RelationType;
}

/**
 * Detect whether adding (source -> target) of type "blocks" creates a cycle.
 * Walks the graph forward from `target` following blocks/blocked_by; if we reach `source`, cycle.
 */
async function detectCycle(sourceId: string, targetId: string): Promise<boolean> {
  if (sourceId === targetId) return true;
  const seen = new Set<string>([sourceId]);
  const queue: string[] = [targetId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (cur === sourceId) return true;
    const { data, error } = await supabase
      .from("task_relations")
      .select("source_task_id, target_task_id, relation_type")
      .or(`source_task_id.eq.${cur},target_task_id.eq.${cur}`)
      .in("relation_type", ["blocks", "blocked_by"]);
    if (error) break;
    for (const r of (data ?? []) as { source_task_id: string; target_task_id: string; relation_type: RelationType }[]) {
      // Outgoing "blocks" from cur: cur blocks X
      if (r.relation_type === "blocks" && r.source_task_id === cur) queue.push(r.target_task_id);
      // Incoming "blocked_by" pointing at cur: X blocked_by cur means cur blocks X
      if (r.relation_type === "blocked_by" && r.target_task_id === cur) queue.push(r.source_task_id);
    }
  }
  return false;
}

export function useCreateRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, sourceTaskId, targetTaskId, relationType }: CreateRelationInput) => {
      if (sourceTaskId === targetTaskId) {
        throw new Error("A task cannot relate to itself.");
      }
      // Cycle detection for hard dependencies
      if (relationType === "blocks" || relationType === "blocked_by") {
        // Normalize to (blocker -> blocked) form
        const blocker = relationType === "blocks" ? sourceTaskId : targetTaskId;
        const blocked = relationType === "blocks" ? targetTaskId : sourceTaskId;
        if (await detectCycle(blocker, blocked)) {
          throw new Error("Circular dependency detected.");
        }
      }
      const { data, error } = await supabase
        .from("task_relations")
        .insert({
          workspace_id: workspaceId,
          source_task_id: sourceTaskId,
          target_task_id: targetTaskId,
          relation_type: relationType,
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("That relation already exists.");
        throw error;
      }
      return data as TaskRelation;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: relationsKey(vars.sourceTaskId) });
      qc.invalidateQueries({ queryKey: relationsKey(vars.targetTaskId) });
      qc.invalidateQueries({ queryKey: ["project-relations"] });
      toast.success("Relation added");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rel: TaskRelation) => {
      const { error } = await supabase.from("task_relations").delete().eq("id", rel.id);
      if (error) throw error;
      return rel;
    },
    onSuccess: (rel) => {
      qc.invalidateQueries({ queryKey: relationsKey(rel.source_task_id) });
      qc.invalidateQueries({ queryKey: relationsKey(rel.target_task_id) });
      qc.invalidateQueries({ queryKey: ["project-relations"] });
      toast.success("Relation removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
