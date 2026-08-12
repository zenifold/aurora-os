import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  DEFAULT_VOCABULARY,
  mergeVocabulary,
  type Vocabulary,
} from "@/lib/vocabulary";

/** Returns the merged vocabulary for the current workspace. */
export function useVocabulary(): Vocabulary {
  const ws = useWorkspaceStore((s) => s.current);

  const { data } = useQuery({
    queryKey: ["workspace-vocabulary", ws?.id],
    enabled: !!ws,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("settings")
        .eq("id", ws!.id)
        .single();
      if (error) throw error;
      const settings = (data?.settings ?? {}) as { vocabulary?: unknown };
      return mergeVocabulary(settings.vocabulary);
    },
  });

  return useMemo(() => data ?? DEFAULT_VOCABULARY, [data]);
}

/** Update workspace vocabulary. Requires owner/manager via RLS. */
export function useUpdateVocabulary() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (next: Vocabulary) => {
      if (!ws) throw new Error("No workspace");
      // Read-modify-write to preserve other settings keys.
      const { data: current, error: readErr } = await supabase
        .from("workspaces")
        .select("settings")
        .eq("id", ws.id)
        .single();
      if (readErr) throw readErr;
      const merged = {
        ...((current?.settings ?? {}) as Record<string, unknown>),
        vocabulary: next,
      };
      const { error } = await supabase
        .from("workspaces")
        .update({ settings: merged })
        .eq("id", ws.id);
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-vocabulary", ws?.id] });
    },
  });
}
