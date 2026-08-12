import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Meeting, MeetingActionItem } from "@/lib/meeting-types";
import { toast } from "sonner";

export function useMeetings() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["meetings", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Meeting[];
    },
  });
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: ["meeting", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Meeting | null;
    },
  });
}

export function useMeetingActionItems(meetingId: string | undefined) {
  return useQuery({
    queryKey: ["meeting-action-items", meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_action_items")
        .select("*")
        .eq("meeting_id", meetingId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as MeetingActionItem[];
    },
  });
}

export function useCreateMeeting() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      project_id?: string | null;
      transcript_raw_text?: string | null;
      participant_emails?: string[];
      description?: string | null;
    }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          workspace_id: ws.id,
          title: input.title,
          project_id: input.project_id ?? null,
          transcript_raw_text: input.transcript_raw_text ?? null,
          participant_emails: input.participant_emails ?? [],
          description: input.description ?? null,
          organizer_id: user.id,
          created_by: user.id,
          platform: "manual_upload",
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Meeting;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Meeting> }) => {
      const { data, error } = await supabase
        .from("meetings")
        .update(input.patch as never)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Meeting;
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["meeting", m.id] });
    },
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export function useUpdateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; meeting_id: string; patch: Partial<MeetingActionItem> }) => {
      const { error } = await supabase
        .from("meeting_action_items")
        .update(input.patch as never)
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["meeting-action-items", input.meeting_id] });
    },
  });
}

// ============== Participants ==============

export interface MeetingParticipant {
  id: string;
  workspace_id: string;
  meeting_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: string | null;
  speaking_time_seconds: number | null;
  created_at: string;
}

export function useMeetingParticipants(meetingId: string | undefined) {
  return useQuery({
    queryKey: ["meeting-participants", meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_participants")
        .select("*")
        .eq("meeting_id", meetingId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as MeetingParticipant[];
    },
  });
}

export function useAddParticipant() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      meeting_id: string;
      email: string;
      name?: string | null;
      user_id?: string | null;
      role?: string;
    }) => {
      if (!ws) throw new Error("No workspace");
      const { error } = await supabase.from("meeting_participants").insert({
        workspace_id: ws.id,
        meeting_id: input.meeting_id,
        email: input.email.trim().toLowerCase(),
        name: input.name ?? null,
        user_id: input.user_id ?? null,
        role: input.role ?? "required",
      });
      if (error) throw error;
      return input.meeting_id;
    },
    onSuccess: (mid) => qc.invalidateQueries({ queryKey: ["meeting-participants", mid] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; meeting_id: string }) => {
      const { error } = await supabase.from("meeting_participants").delete().eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (i) => qc.invalidateQueries({ queryKey: ["meeting-participants", i.meeting_id] }),
  });
}

export interface ProjectDecision {
  meetingId: string;
  meetingTitle: string;
  at: string;
  text: string;
}

export function useProjectDecisions(projectId: string | undefined) {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["project-decisions", projectId, ws?.id],
    enabled: !!ws && !!projectId,
    queryFn: async (): Promise<ProjectDecision[]> => {
      const { data } = await supabase
        .from("meetings")
        .select("id, title, summary, updated_at, ai_status")
        .eq("workspace_id", ws!.id)
        .eq("project_id", projectId!)
        .eq("ai_status", "completed")
        .order("updated_at", { ascending: false })
        .limit(20);
      const rows = (data ?? []) as Array<{
        id: string;
        title: string;
        summary: { decisions?: string[] } | null;
        updated_at: string;
      }>;
      const out: ProjectDecision[] = [];
      for (const m of rows) {
        const decs = m.summary?.decisions ?? [];
        for (const d of decs) {
          if (typeof d === "string" && d.trim().length > 0) {
            out.push({ meetingId: m.id, meetingTitle: m.title, at: m.updated_at, text: d });
          }
        }
      }
      return out;
    },
  });
}
