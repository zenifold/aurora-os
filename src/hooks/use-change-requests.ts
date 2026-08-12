import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";

export interface ChangeRequest {
  id: string;
  workspace_id: string;
  project_id: string;
  client_portal_access_id: string | null;
  title: string;
  description: string;
  urgency: "low" | "normal" | "high" | "urgent";
  impact_areas: string[];
  status: "submitted" | "in_review" | "approved" | "rejected" | "scheduled";
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  estimated_cost: number | null;
  estimated_days: number | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useChangeRequests(projectId?: string) {
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  return useQuery({
    queryKey: ["change_requests", workspaceId, projectId ?? "all"],
    enabled: !!workspaceId,
    queryFn: async (): Promise<ChangeRequest[]> => {
      let q = supabase
        .from("change_requests")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ChangeRequest[];
    },
  });
}

export function useUpdateChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { id: string } & Partial<
        Pick<
          ChangeRequest,
          | "status"
          | "review_notes"
          | "estimated_cost"
          | "estimated_days"
        >
      >,
    ) => {
      const { id, ...patch } = input;
      const update: {
        status?: ChangeRequest["status"];
        review_notes?: string | null;
        estimated_cost?: number | null;
        estimated_days?: number | null;
        reviewed_at?: string;
      } = { ...patch };
      if (patch.status && patch.status !== "submitted") {
        update.reviewed_at = new Date().toISOString();
      }
      const { data, error } = await supabase
        .from("change_requests")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return data as unknown as ChangeRequest;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change_requests"] });
      toast.success("Change request updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
