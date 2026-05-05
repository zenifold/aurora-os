import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type {
  ClientPortalAccess,
  ClientDeliverable,
  ClientRole,
  DeliverableType,
  DeliverableReviewStatus,
} from "@/lib/client-portal-types";

// ===== Portal access (internal view) =====

export function useClientAccess(projectId?: string) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["client_portal_access", ws?.id, projectId],
    enabled: !!ws && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_portal_access" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("project_id", projectId!)
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClientPortalAccess[];
    },
  });
}

export function useInviteClient() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      email: string;
      name: string;
      company?: string;
      role?: ClientRole;
      can_see_financials?: boolean;
      can_see_team_names?: boolean;
      can_see_timeline?: boolean;
    }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("client_portal_access" as never)
        .insert({
          workspace_id: ws.id,
          project_id: input.project_id,
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          company: input.company?.trim() || null,
          role: input.role ?? "contributor",
          can_see_financials: input.can_see_financials ?? false,
          can_see_team_names: input.can_see_team_names ?? true,
          can_see_timeline: input.can_see_timeline ?? true,
          invited_by: user.id,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ClientPortalAccess;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["client_portal_access", ws?.id, vars.project_id] });
      toast.success("Client invited");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateClientAccess() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ClientPortalAccess> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase
        .from("client_portal_access" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_portal_access", ws?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeClientAccess() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_portal_access" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_portal_access", ws?.id] });
      toast.success("Access revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== Deliverables (internal view) =====

export function useDeliverables(projectId?: string) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["client_deliverables", ws?.id, projectId],
    enabled: !!ws && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_deliverables" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClientDeliverable[];
    },
  });
}

export function useUpsertDeliverable() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      project_id: string;
      task_id: string;
      client_portal_access_id?: string | null;
      deliverable_type: DeliverableType;
      client_instructions?: string | null;
      client_deadline?: string | null;
      impact_description?: string | null;
      downstream_task_ids?: string[];
    }) => {
      if (!ws) throw new Error("No workspace");
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await supabase
          .from("client_deliverables" as never)
          .update(patch as never)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("client_deliverables" as never)
        .insert({ workspace_id: ws.id, ...input } as never);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["client_deliverables", ws?.id, vars.project_id] });
      toast.success("Deliverable saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReviewDeliverable() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      review_status: DeliverableReviewStatus;
      review_notes?: string | null;
    }) => {
      const patch: Record<string, unknown> = {
        review_status: input.review_status,
        review_notes: input.review_notes ?? null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("client_deliverables" as never)
        .update(patch as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_deliverables", ws?.id] });
      toast.success("Deliverable reviewed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== Public portal access (token-based, anonymous) =====

export function buildPortalUrl(token: string) {
  return `${window.location.origin}/client/${token}`;
}

export interface PortalSession {
  access: ClientPortalAccess;
  project: {
    id: string;
    name: string;
    color: string;
    description: string | null;
  };
}

/**
 * Token-based portal load. Anonymous client. Anyone holding the token can read
 * the access row + scoped project + deliverables. RLS does not apply to anon
 * for these tables (they are not granted), so we expose this through the
 * supabase JS using the publishable key + a select on access_token.
 *
 * Note: client_portal_access has authenticated-only RLS. For anon access we
 * need to reach the data through a public view or server route. To keep this
 * v1 simple, we store the lookup logic here and document that the full
 * production flow should go through a server route.
 */
export function usePortalSession(token: string | undefined) {
  return useQuery({
    queryKey: ["portal_session", token],
    enabled: !!token,
    queryFn: async (): Promise<PortalSession | null> => {
      const res = await fetch(`/api/public/portal/${token}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Portal load failed (${res.status})`);
      }
      return (await res.json()) as PortalSession;
    },
  });
}

export interface PortalDeliverableView extends ClientDeliverable {
  task_title: string;
  task_status: string;
}

export function usePortalDeliverables(token: string | undefined) {
  return useQuery({
    queryKey: ["portal_deliverables", token],
    enabled: !!token,
    queryFn: async (): Promise<PortalDeliverableView[]> => {
      const res = await fetch(`/api/public/portal/${token}/deliverables`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return (await res.json()) as PortalDeliverableView[];
    },
  });
}

export function useSubmitPortalDeliverable(token: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      deliverable_id: string;
      decision?: string;
      comments?: string;
    }) => {
      const res = await fetch(`/api/public/portal/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Submit failed (${res.status})`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal_deliverables", token] });
      toast.success("Submitted to the team");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
