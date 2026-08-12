import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { extractText, type Page, type PageScope, type PageType } from "@/lib/page-types";
import { toast } from "sonner";

export function usePages(opts: { scope?: PageScope; scopeId?: string | null; archived?: boolean } = {}) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["pages", ws?.id, opts.scope ?? "all", opts.scopeId ?? null, opts.archived ?? false],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("pages" as never)
        .select("*")
        .eq("workspace_id", ws!.id)
        .eq("is_archived", opts.archived ?? false)
        .order("is_pinned", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });
      if (opts.scope) q = q.eq("scope", opts.scope);
      if (opts.scopeId !== undefined && opts.scopeId !== null) q = q.eq("scope_id", opts.scopeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Page[];
    },
  });

  useEffect(() => {
    if (!ws) return;
    const ch = supabase.channel(`pages-${ws.id}-${Math.random().toString(36).slice(2)}`);
    ch.on(
      "postgres_changes" as never,
      { event: "*", schema: "public", table: "pages", filter: `workspace_id=eq.${ws.id}` },
      () => {
        qc.invalidateQueries({ queryKey: ["pages", ws.id] });
      },
    ).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ws, qc]);

  return query;
}

export function usePage(id: string | null | undefined) {
  return useQuery({
    queryKey: ["page", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("pages" as never).select("*").eq("id", id!).single();
      if (error) throw error;
      return data as unknown as Page;
    },
  });
}

export function useCreatePage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title?: string;
      scope?: PageScope;
      scope_id?: string | null;
      page_type?: PageType;
      icon?: string;
      content?: unknown;
      parent_page_id?: string | null;
      ai_managed?: boolean;
    }) => {
      if (!ws || !user) throw new Error("Not signed in");
      const content = input.content ?? { type: "doc", content: [{ type: "paragraph" }] };
      const { data, error } = await supabase
        .from("pages" as never)
        .insert({
          workspace_id: ws.id,
          created_by: user.id,
          updated_by: user.id,
          title: input.title ?? "Untitled",
          scope: input.scope ?? "workspace",
          scope_id: input.scope_id ?? null,
          page_type: input.page_type ?? "doc",
          icon: input.icon ?? null,
          content,
          content_text: extractText(content),
          parent_page_id: input.parent_page_id ?? null,
          ai_managed: input.ai_managed ?? false,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Page;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", ws?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Page> & { id: string }) => {
      const { id, content, ...rest } = input;
      const patch: Record<string, unknown> = { ...rest, updated_by: user?.id };
      if (content !== undefined) {
        patch.content = content;
        patch.content_text = extractText(content);
      }
      const { data, error } = await supabase.from("pages" as never).update(patch as never).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as Page;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["pages", ws?.id] });
      qc.invalidateQueries({ queryKey: ["page", v.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePage() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pages" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", ws?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
