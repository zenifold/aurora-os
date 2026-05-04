import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export type ThemePref = "light" | "dark" | "system";
export type DensityPref = "comfortable" | "compact" | "ultra";
export type FontSizePref = "small" | "default" | "large" | "xlarge";
export type LandingPref = "dashboard" | "my-tasks" | "last-project";
export type DefaultViewPref = "table" | "kanban" | "calendar";
export type ConfirmDeletesPref = "always" | "bulk" | "never";

export interface UserPreferences {
  id: string;
  user_id: string;
  theme: ThemePref;
  density: DensityPref;
  font_size: FontSizePref;
  reduced_motion: boolean;
  high_contrast: boolean;
  default_landing: LandingPref;
  default_view_type: DefaultViewPref;
  confirm_deletes: ConfirmDeletesPref;
  accent_preference: string;
}

const DEFAULTS: Omit<UserPreferences, "id" | "user_id"> = {
  theme: "system",
  density: "comfortable",
  font_size: "default",
  reduced_motion: false,
  high_contrast: false,
  default_landing: "dashboard",
  default_view_type: "table",
  confirm_deletes: "always",
  accent_preference: "workspace",
};

export function useUserPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-preferences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // create defaults row
        const { data: created, error: insErr } = await supabase
          .from("user_preferences")
          .insert({ user_id: user!.id, ...DEFAULTS })
          .select()
          .single();
        if (insErr) {
          // race / RLS issues — return defaults in-memory
          return { id: "_local", user_id: user!.id, ...DEFAULTS } as UserPreferences;
        }
        return created as UserPreferences;
      }
      return data as UserPreferences;
    },
  });
}

export function useUpdateUserPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<UserPreferences, "id" | "user_id">>) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, ...DEFAULTS, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["user-preferences", user?.id] });
      const prev = qc.getQueryData<UserPreferences>(["user-preferences", user?.id]);
      if (prev) {
        qc.setQueryData(["user-preferences", user?.id], { ...prev, ...patch });
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["user-preferences", user?.id], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["user-preferences", user?.id] });
    },
  });
}
