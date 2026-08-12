import { useMemo } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useWorkspaceRole, useIsWorkspaceOwner } from "@/hooks/use-workspace-role";
import { useUserPreferences, useUpdateUserPreferences } from "@/hooks/use-user-preferences";

export const GATED_NAV_ITEMS = ["resources", "capacity", "finance", "forecast", "executive", "escalations", "pipeline-analytics"] as const;
export type GatedNavKey = (typeof GATED_NAV_ITEMS)[number];

export const NAV_LABELS: Record<GatedNavKey, string> = {
  resources: "Resources",
  capacity: "Capacity",
  finance: "Finance",
  forecast: "Forecast",
  executive: "Executive",
  escalations: "Escalations",
  "pipeline-analytics": "Pipeline analytics",
};

const DEFAULT_VISIBILITY: Record<GatedNavKey, string[]> = {
  resources: ["owner", "manager", "member"],
  capacity: ["owner", "manager", "member"],
  finance: ["owner", "manager"],
  forecast: ["owner", "manager"],
  executive: ["owner", "manager"],
  escalations: ["owner", "manager", "member"],
  "pipeline-analytics": ["owner", "manager"],
};

export function useNavVisibility() {
  const ws = useWorkspaceStore((s) => s.current);
  const isOwner = useIsWorkspaceOwner();
  const { data: role } = useWorkspaceRole();
  const { data: prefs } = useUserPreferences();
  const update = useUpdateUserPreferences();

  const wsVisibility = useMemo(() => {
    const v = (ws as unknown as { nav_visibility?: Record<string, string[]> } | null)?.nav_visibility;
    return { ...DEFAULT_VISIBILITY, ...(v ?? {}) };
  }, [ws]);

  const hidden = new Set(prefs?.hidden_nav_items ?? []);
  const effectiveRole = isOwner ? "owner" : (role ?? "member");

  const canSee = (key: string): boolean => {
    if (!(GATED_NAV_ITEMS as readonly string[]).includes(key)) return true;
    const allowed = wsVisibility[key as GatedNavKey] ?? DEFAULT_VISIBILITY[key as GatedNavKey];
    return allowed.includes(effectiveRole);
  };

  const isHidden = (key: string) => hidden.has(key);

  const setHidden = async (key: string, hide: boolean) => {
    const next = new Set(prefs?.hidden_nav_items ?? []);
    if (hide) next.add(key); else next.delete(key);
    await update.mutateAsync({ hidden_nav_items: Array.from(next) });
  };

  return { canSee, isHidden, setHidden, wsVisibility, effectiveRole, isOwner };
}
