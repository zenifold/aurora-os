import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";

export type TimesheetStatus = "submitted" | "approved" | "rejected";

export interface TimesheetSubmission {
  id: string;
  workspace_id: string;
  user_id: string;
  week_start: string;
  total_hours: number;
  billable_hours: number;
  status: TimesheetStatus;
  submitter_notes: string | null;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

const TABLE = "timesheet_submissions" as never;

export function useMyWeekSubmission(weekStart: string) {
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["timesheet_submissions", "mine", user?.id, ws?.id, weekStart],
    enabled: !!user?.id && !!ws?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("user_id", user!.id)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as TimesheetSubmission | null;
    },
  });
}

export function useSubmitWeek() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const ws = useWorkspaceStore((s) => s.current);
  return useMutation({
    mutationFn: async (input: {
      week_start: string;
      total_hours: number;
      billable_hours: number;
      submitter_notes?: string | null;
    }) => {
      if (!user || !ws) throw new Error("Not ready");
      const { error } = await supabase
        .from(TABLE)
        .upsert(
          {
            workspace_id: ws.id,
            user_id: user.id,
            week_start: input.week_start,
            total_hours: input.total_hours,
            billable_hours: input.billable_hours,
            submitter_notes: input.submitter_notes ?? null,
            status: "submitted",
            submitted_at: new Date().toISOString(),
            reviewer_id: null,
            reviewer_notes: null,
            reviewed_at: null,
          } as never,
          { onConflict: "workspace_id,user_id,week_start" } as never,
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheet_submissions"] });
      toast.success("Timesheet submitted for approval");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useWithdrawSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheet_submissions"] });
      toast.success("Submission withdrawn");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePendingSubmissions() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["timesheet_submissions", "pending", ws?.id],
    enabled: !!ws?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("submitted_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as TimesheetSubmission[];
    },
  });
}

export function useReviewSubmission() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: "approved" | "rejected";
      reviewer_notes?: string | null;
    }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({
          status: input.status,
          reviewer_id: user?.id ?? null,
          reviewer_notes: input.reviewer_notes ?? null,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["timesheet_submissions"] });
      toast.success(vars.status === "approved" ? "Approved" : "Rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
