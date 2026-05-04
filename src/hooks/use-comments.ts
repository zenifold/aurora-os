import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export interface Comment {
  id: string;
  task_id: string;
  workspace_id: string;
  author_id: string;
  parent_id: string | null;
  content: unknown;
  created_at: string;
  updated_at: string;
  author?: { id: string; display_name: string | null; avatar_url: string | null };
}

export function useComments(taskId: string | null) {
  return useQuery({
    queryKey: ["comments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as Comment[];
      const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
      if (authorIds.length === 0) return rows;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", authorIds);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((c) => ({ ...c, author: byId.get(c.author_id) ?? undefined }));
    },
  });
}

export function useCreateComment(taskId: string) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { content: unknown; parent_id?: string | null }) => {
      if (!ws || !user) throw new Error("Not signed in");
      const { error } = await supabase.from("comments").insert({
        task_id: taskId,
        workspace_id: ws.id,
        author_id: user.id,
        parent_id: input.parent_id ?? null,
        content: input.content as never,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: unknown }) => {
      const { error } = await supabase
        .from("comments")
        .update({ content: content as never, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", taskId] });
      toast.success("Comment deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
