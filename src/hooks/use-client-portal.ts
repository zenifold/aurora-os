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

export function useRotatePortalToken() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Generate a hex token client-side (48 chars) — RLS allows workspace members to update.
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await supabase
        .from("client_portal_access" as never)
        .update({ access_token: token, last_login_at: null } as never)
        .eq("id", id);
      if (error) throw error;
      return token;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_portal_access", ws?.id] });
      toast.success("Portal link rotated — old link no longer works");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface PortalActivity {
  id: string;
  activity_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  client_portal_access_id: string | null;
}

export function usePortalActivity(projectId?: string, limit = 50) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["portal_activity", ws?.id, projectId, limit],
    enabled: !!ws && !!projectId,
    queryFn: async (): Promise<PortalActivity[]> => {
      const { data, error } = await supabase
        .from("portal_activity_log" as never)
        .select("id, activity_type, metadata, created_at, client_portal_access_id")
        .eq("workspace_id", ws!.id)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as PortalActivity[];
    },
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

// ===== Team-side deliverable comments =====

export interface DeliverableComment {
  id: string;
  author_kind: "team" | "client";
  author_name: string;
  body: string;
  created_at: string;
  author_user_id: string | null;
}

export function useDeliverableComments(deliverableId: string | undefined) {
  return useQuery({
    queryKey: ["deliverable_comments", deliverableId],
    enabled: !!deliverableId,
    queryFn: async (): Promise<DeliverableComment[]> => {
      const { data, error } = await supabase
        .from("portal_deliverable_comments" as never)
        .select("id, author_kind, author_name, body, created_at, author_user_id")
        .eq("deliverable_id", deliverableId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DeliverableComment[];
    },
  });
}

export function useAddTeamDeliverableComment() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      deliverable_id: string;
      project_id: string;
      body: string;
      author_name: string;
    }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { error } = await supabase
        .from("portal_deliverable_comments" as never)
        .insert({
          workspace_id: ws.id,
          project_id: input.project_id,
          deliverable_id: input.deliverable_id,
          author_kind: "team",
          author_user_id: user.id,
          author_name: input.author_name,
          body: input.body.trim(),
        } as never);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["deliverable_comments", vars.deliverable_id] });
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
      qc.invalidateQueries({ queryKey: ["portal_impact", token] });
      toast.success("Submitted to the team");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUploadPortalFile(token: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { deliverable_id: string; file: File }) => {
      const fd = new FormData();
      fd.append("deliverable_id", input.deliverable_id);
      fd.append("file", input.file);
      const res = await fetch(`/api/public/portal/${token}/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      return (await res.json()) as { ok: true; path: string; name: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal_deliverables", token] });
      toast.success("File uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface PortalImpactNode {
  deliverable_id: string;
  task_id: string;
  task_title: string;
  deliverable_type: string;
  client_deadline: string | null;
  review_status: string;
  is_overdue: boolean;
  impact_description: string | null;
  downstream: Array<{
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    start_date: string | null;
  }>;
}

export interface PortalOverview {
  workspace: {
    id: string;
    name: string;
    branding: Partial<{
      appName: string;
      logoUrl: string;
      primaryColor: string;
    }> & Record<string, unknown>;
  } | null;
  milestones: Array<{
    id: string;
    name: string;
    status: string;
    target_date: string | null;
    actual_date: string | null;
    order_index: number;
    requires_signoff?: boolean;
    signoff_status?: "not_required" | "pending" | "requested" | "approved" | "rejected";
    signoff_requested_at?: string | null;
    signoff_signed_at?: string | null;
    signoff_signed_name?: string | null;
    signoff_rejection_reason?: string | null;
  }>;
  progress: { total: number; done: number; in_progress: number; percent: number };
}

export function usePortalOverview(token: string | undefined) {
  return useQuery({
    queryKey: ["portal_overview", token],
    enabled: !!token,
    queryFn: async (): Promise<PortalOverview> => {
      const res = await fetch(`/api/public/portal/${token}/overview`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return (await res.json()) as PortalOverview;
    },
  });
}

export function useSubmitMilestoneSignoff(token: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      milestone_id: string;
      action: "approve" | "reject";
      signed_name: string;
      signature_text?: string;
      notes?: string;
    }) => {
      const res = await fetch(`/api/public/portal/${token}/milestones/signoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ ok: true; status: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal_overview", token] });
    },
  });
}

export interface PortalComment {
  id: string;
  author_kind: "team" | "client";
  author_name: string;
  body: string;
  created_at: string;
}

export function usePortalComments(token: string | undefined, deliverableId: string | undefined) {
  return useQuery({
    queryKey: ["portal_comments", token, deliverableId],
    enabled: !!token && !!deliverableId,
    queryFn: async (): Promise<PortalComment[]> => {
      const res = await fetch(
        `/api/public/portal/${token}/comments?deliverable_id=${deliverableId}`,
      );
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return (await res.json()) as PortalComment[];
    },
  });
}

export function useAddPortalComment(token: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { deliverable_id: string; body: string }) => {
      const res = await fetch(`/api/public/portal/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["portal_comments", token, vars.deliverable_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePortalImpact(token: string | undefined) {
  return useQuery({
    queryKey: ["portal_impact", token],
    enabled: !!token,
    queryFn: async (): Promise<PortalImpactNode[]> => {
      const res = await fetch(`/api/public/portal/${token}/impact`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return (await res.json()) as PortalImpactNode[];
    },
  });
}

// ===== Intake forms (public portal) =====

export interface PortalIntakeForm {
  id: string;
  title: string;
  description: string | null;
  fields: Array<{
    id: string;
    type: string;
    label: string;
    help?: string;
    required?: boolean;
    options?: string[];
    placeholder?: string;
  }>;
  status: string;
  visibility: string;
  updated_at: string;
  submitted: boolean;
}

export function usePortalIntakeForms(token: string | undefined) {
  return useQuery({
    queryKey: ["portal_intake_forms", token],
    enabled: !!token,
    queryFn: async (): Promise<PortalIntakeForm[]> => {
      const res = await fetch(`/api/public/portal/${token}/forms`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const j = (await res.json()) as { forms: PortalIntakeForm[] };
      return j.forms;
    },
  });
}

export function useSubmitPortalIntakeForm(token: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      form_id: string;
      respondent_name?: string;
      respondent_email?: string;
      answers: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/public/portal/${token}/forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal_intake_forms", token] });
      toast.success("Submitted — thank you!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================================
// Portal invoices (read-only view for clients with can_see_invoices)
// ============================================================================

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  sent_at: string | null;
  paid_at: string | null;
}

export function usePortalInvoices(token: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["portal_invoices", token],
    enabled: !!token && enabled,
    queryFn: async (): Promise<PortalInvoice[]> => {
      const res = await fetch(`/api/public/portal/${token}/invoices`);
      if (res.status === 403) return [];
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return (await res.json()) as PortalInvoice[];
    },
  });
}

// ============================================================================
// Portal documents (gated library)
// ============================================================================

export interface PortalDocument {
  id: string;
  name: string;
  description: string | null;
  document_type: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  version: number;
  signature_status: string;
  signed_at: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  contract_value: number | null;
  currency: string | null;
  created_at: string;
}

export function usePortalDocuments(token: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["portal_documents", token],
    enabled: !!token && enabled,
    queryFn: async (): Promise<PortalDocument[]> => {
      const res = await fetch(`/api/public/portal/${token}/documents`);
      if (res.status === 403) return [];
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return (await res.json()) as PortalDocument[];
    },
  });
}

export async function fetchPortalDocumentUrl(
  token: string,
  document_id: string,
): Promise<string> {
  const res = await fetch(`/api/public/portal/${token}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id }),
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const { url } = (await res.json()) as { url: string };
  return url;
}

// ============================================================================
// Change requests (submitted by clients from the portal)
// ============================================================================

export interface PortalChangeRequest {
  id: string;
  title: string;
  description: string;
  urgency: "low" | "normal" | "high" | "urgent";
  impact_areas: Array<"scope" | "timeline" | "cost" | "quality">;
  status: "submitted" | "in_review" | "approved" | "rejected" | "scheduled";
  estimated_cost: number | null;
  estimated_days: number | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export function usePortalChangeRequests(token: string | undefined) {
  return useQuery({
    queryKey: ["portal_change_requests", token],
    enabled: !!token,
    queryFn: async (): Promise<PortalChangeRequest[]> => {
      const res = await fetch(`/api/public/portal/${token}/change-requests`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return (await res.json()) as PortalChangeRequest[];
    },
  });
}

export function useSubmitPortalChangeRequest(token: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      urgency: PortalChangeRequest["urgency"];
      impact_areas: PortalChangeRequest["impact_areas"];
    }) => {
      const res = await fetch(`/api/public/portal/${token}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Failed (${res.status})`);
      }
      return (await res.json()) as PortalChangeRequest;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal_change_requests", token] });
      toast.success("Change request submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

