import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { type BrandConfig, getDefaultBrand, mergeBrand } from "@/lib/brand";

/**
 * Returns the merged brand config for the current workspace.
 * Falls back to defaults when there is no workspace selected.
 */
export function useBrand(): BrandConfig {
  const ws = useWorkspaceStore((s) => s.current);

  const { data } = useQuery({
    queryKey: ["workspace-branding", ws?.id],
    enabled: !!ws,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("branding, logo_url")
        .eq("id", ws!.id)
        .single();
      if (error) throw error;
      const branding = (data?.branding ?? {}) as Partial<BrandConfig>;
      // logo_url has its own column; fold it in if branding doesn't override it.
      if (!branding.logoUrl && data?.logo_url) branding.logoUrl = data.logo_url;
      return branding;
    },
  });

  return useMemo(() => (data ? mergeBrand(data) : getDefaultBrand()), [data]);
}
