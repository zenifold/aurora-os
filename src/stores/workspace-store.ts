import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export type WorkspaceKind = "sales" | "delivery" | "hybrid";
export type WorkspaceMode = "solo" | "internal_team" | "client_services";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: string;
  kind: WorkspaceKind;
  workspace_mode: WorkspaceMode;
  linked_delivery_workspace_id: string | null;
  nav_visibility?: Record<string, string[]> | null;
  logo_url?: string | null;
}

interface WorkspaceState {
  current: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  setCurrent: (w: Workspace | null) => void;
  fetch: () => Promise<void>;
}

const STORAGE_KEY = "aura-current-workspace";

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  current: null,
  workspaces: [],
  loading: false,
  setCurrent: (w) => {
    if (w && typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, w.id);
    set({ current: w });
  },
  fetch: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, slug, owner_id, plan, kind, workspace_mode, linked_delivery_workspace_id, nav_visibility, logo_url")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Fetch workspaces error:", error);
      set({ loading: false });
      return;
    }
    const workspaces = (data ?? []) as Workspace[];
    let current = get().current;
    // Drop stale current if it's no longer in the accessible list (e.g. after switching accounts)
    if (current && !workspaces.find((w) => w.id === current!.id)) {
      current = null;
    }
    if (!current && workspaces.length > 0) {
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      current = workspaces.find((w) => w.id === stored) ?? workspaces[0];
      if (current && typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, current.id);
    } else if (current) {
      const fresh = workspaces.find((w) => w.id === current!.id);
      if (fresh) current = fresh;
    }
    set({ workspaces, current, loading: false });

  },
}));
