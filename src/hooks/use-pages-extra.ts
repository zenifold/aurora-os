import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  rebuildPageLinks,
  setPagePortalPublished,
  upsertBlockAttribution,
  reviewBlockAttribution,
} from "@/server/pages-extra.functions";
import { toast } from "sonner";

export function useRebuildPageLinks() {
  const fn = useServerFn(rebuildPageLinks);
  return useMutation({
    mutationFn: (page_id: string) => fn({ data: { page_id } }),
  });
}

export function useSetPortalPublished() {
  const fn = useServerFn(setPagePortalPublished);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { page_id: string; published: boolean }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page"] });
    },
  });
}

export function usePageAttributions(pageId: string | null | undefined) {
  return useQuery({
    queryKey: ["page-attributions", pageId],
    enabled: !!pageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_block_attributions" as never)
        .select("*")
        .eq("page_id", pageId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        page_id: string;
        block_id: string;
        source: "ai" | "human" | "agent";
        agent_name: string | null;
        model: string | null;
        prompt: string | null;
        reasoning: string | null;
        status: "draft" | "review" | "published" | "reverted";
        created_by: string | null;
        reviewed_by: string | null;
        reviewed_at: string | null;
        created_at: string;
      }>;
    },
  });
}

type UpsertInput = {
  page_id: string;
  block_id: string;
  source?: "ai" | "human" | "agent";
  agent_name?: string | null;
  agent_id?: string | null;
  model?: string | null;
  prompt?: string | null;
  reasoning?: string | null;
  status?: "draft" | "review" | "published" | "reverted";
};

export function useUpsertAttribution() {
  const fn = useServerFn(upsertBlockAttribution);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertInput) => fn({ data: input as never }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["page-attributions", v.page_id] }),
  });
}


export function useReviewAttribution() {
  const fn = useServerFn(reviewBlockAttribution);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: "draft" | "review" | "published" | "reverted" }) =>
      fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page-attributions"] });
      toast.success("Attribution updated");
    },
  });
}

export function useBacklinkRefs(pageId: string | null | undefined) {
  return useQuery({
    queryKey: ["backlink-refs", pageId],
    enabled: !!pageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_links")
        .select("source_page_id, link_type, source_block_id")
        .eq("target_page_id", pageId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePageGraph() {
  return useQuery({
    queryKey: ["page-graph"],
    queryFn: async () => {
      const [{ data: pages }, { data: links }] = await Promise.all([
        supabase.from("pages").select("id, title, icon, scope, scope_id, is_archived").eq("is_archived", false),
        supabase.from("page_links").select("source_page_id, target_page_id, link_type"),
      ]);
      return {
        pages: pages ?? [],
        links: (links ?? []).filter((l) => l.target_page_id),
      };
    },
  });
}
