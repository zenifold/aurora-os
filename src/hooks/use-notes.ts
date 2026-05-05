import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Note, NoteType } from "@/lib/types";
import { toast } from "sonner";

const PIN_LIMIT = 10;

export function useNotes(opts: { archived?: boolean; projectId?: string | null } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notes", ws?.id, opts.archived ?? false, opts.projectId ?? "all"],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("notes")
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", opts.archived ?? false)
        .order("is_pinned", { ascending: false })
        .order("pin_order", { ascending: true })
        .order("updated_at", { ascending: false });
      if (opts.projectId) q = q.eq("project_id", opts.projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!ws) return;
    const channel = supabase
      .channel(`notes-${ws.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `workspace_id=eq.${ws.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notes", ws.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ws, qc]);

  return query;
}

export function useCreateNote() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title?: string | null;
      note_type?: NoteType;
      content?: unknown;
      background_color?: string;
      project_id?: string | null;
    }) => {
      if (!ws || !user) throw new Error("Not signed in");
      const defaultContent =
        input.note_type === "check_list"
          ? { type: "doc", content: [{ type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] }] }] }
          : input.note_type === "bullet_list"
          ? { type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] }] }
          : { type: "doc", content: [{ type: "paragraph" }] };
      const { data, error } = await supabase
        .from("notes")
        .insert({
          workspace_id: ws.id,
          created_by: user.id,
          title: input.title ?? null,
          note_type: input.note_type ?? "freeform",
          content: input.content ?? defaultContent,
          background_color: input.background_color ?? "#ffffff",
          project_id: input.project_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", ws?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateNote() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Note> & { id: string }) => {
      const { id, ...patch } = input;
      const { data, error } = await supabase.from("notes").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as Note;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["notes", ws?.id] });
      const keys = qc.getQueryCache().findAll({ queryKey: ["notes", ws?.id] });
      const snapshots: Array<[readonly unknown[], Note[] | undefined]> = [];
      for (const k of keys) {
        const prev = qc.getQueryData<Note[]>(k.queryKey);
        snapshots.push([k.queryKey, prev]);
        if (prev) {
          qc.setQueryData<Note[]>(
            k.queryKey,
            prev.map((n) => (n.id === input.id ? { ...n, ...input } : n)),
          );
        }
      }
      return { snapshots };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.snapshots) for (const [k, v] of ctx.snapshots) qc.setQueryData(k, v);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notes", ws?.id] }),
  });
}

export function useDeleteNote() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", ws?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTogglePin() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: Note) => {
      if (!note.is_pinned) {
        // Check pin limit
        const { count } = await supabase
          .from("notes")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", note.workspace_id)
          .eq("is_pinned", true)
          .eq("is_archived", false);
        if ((count ?? 0) >= PIN_LIMIT) {
          throw new Error(`You can pin up to ${PIN_LIMIT} notes. Unpin one first.`);
        }
      }
      const { error } = await supabase
        .from("notes")
        .update({ is_pinned: !note.is_pinned, pin_order: !note.is_pinned ? Date.now() : 0 })
        .eq("id", note.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", ws?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
