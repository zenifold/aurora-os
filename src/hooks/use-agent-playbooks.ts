import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  listPlaybooks,
  seedDefaultPlaybooks,
  runPlaybook,
  upsertPlaybook,
  deletePlaybook,
} from "@/lib/agent-playbooks.functions";
import type { PlaybookStage, PlaybookTargetKind } from "@/lib/agent-playbook-defaults";

export interface AgentPlaybookRow {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  description: string | null;
  stage: PlaybookStage;
  target_kind: PlaybookTargetKind;
  agent_id: string | null;
  goal_template: string;
  autonomy_override: "suggest" | "bounded" | "autonomous" | null;
  is_active: boolean;
  is_seeded: boolean;
  sort_order: number;
  agent?: { id: string; name: string; avatar_emoji: string | null } | null;
}

export function useAgentPlaybooks(opts?: { stage?: PlaybookStage; target_kind?: PlaybookTargetKind }) {
  const wsId = useWorkspaceStore((s) => s.current?.id);
  const fetchPlaybooks = useServerFn(listPlaybooks);
  const seed = useServerFn(seedDefaultPlaybooks);
  const qc = useQueryClient();

  const query = useQuery({
    enabled: !!wsId,
    queryKey: ["agent-playbooks", wsId, opts?.stage, opts?.target_kind],
    queryFn: async () => {
      const r = await fetchPlaybooks({
        data: { workspace_id: wsId!, stage: opts?.stage, target_kind: opts?.target_kind },
      });
      if (!r.ok) throw new Error(r.error);
      if (r.playbooks.length === 0) {
        await seed({ data: { workspace_id: wsId! } });
        const r2 = await fetchPlaybooks({
          data: { workspace_id: wsId!, stage: opts?.stage, target_kind: opts?.target_kind },
        });
        return r2.ok ? (r2.playbooks as AgentPlaybookRow[]) : [];
      }
      return r.playbooks as AgentPlaybookRow[];
    },
  });

  return {
    ...query,
    invalidate: () => qc.invalidateQueries({ queryKey: ["agent-playbooks", wsId] }),
  };
}

export function useRunAgentPlaybook() {
  const wsId = useWorkspaceStore((s) => s.current?.id);
  const fn = useServerFn(runPlaybook);
  return useMutation({
    mutationFn: async (vars: { playbook_id: string; target_id: string }) => {
      if (!wsId) throw new Error("No workspace");
      const r = await fn({ data: { workspace_id: wsId, ...vars } });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });
}

export function useUpsertAgentPlaybook() {
  const qc = useQueryClient();
  const wsId = useWorkspaceStore((s) => s.current?.id);
  const fn = useServerFn(upsertPlaybook);
  return useMutation({
    mutationFn: async (vars: {
      id?: string;
      workspace_id: string;
      slug: string;
      name: string;
      description?: string;
      stage: PlaybookStage;
      target_kind: PlaybookTargetKind;
      agent_id?: string | null;
      goal_template: string;
      autonomy_override?: "suggest" | "bounded" | "autonomous";
      is_active?: boolean;
      sort_order?: number;
    }) => {
      const r = await fn({ data: vars });
      if (!r.ok) throw new Error(r.error);
      return r.playbook;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-playbooks", wsId] }),
  });
}

export function useDeleteAgentPlaybook() {
  const qc = useQueryClient();
  const wsId = useWorkspaceStore((s) => s.current?.id);
  const fn = useServerFn(deletePlaybook);
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fn({ data: { id } });
      if (!r.ok) throw new Error(r.error);
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-playbooks", wsId] }),
  });
}
