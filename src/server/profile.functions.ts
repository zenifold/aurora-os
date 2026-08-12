import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function authedUserId(): Promise<string | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

export interface UserStats {
  tasks_completed: number;
  tasks_completed_30d: number;
  projects_created: number;
  meetings_hosted: number;
  notes_created: number;
  mentions: number;
  comments_written: number;
  streak_days: number;
}

/** Get computed stats for a user (defaults to caller). */
export const getUserStats = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const me = await authedUserId();
    if (!me) return { ok: false as const, error: "Sign in required" };
    const target = data.user_id ?? me;

    const { data: stats, error } = await supabaseAdmin.rpc("compute_user_stats", {
      _user_id: target,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, stats: (stats ?? {}) as unknown as UserStats };
  });

/** Evaluate and award any newly-earned badges. Returns all earned badges. */
export const evaluateMyBadges = createServerFn({ method: "POST" })
  .handler(async () => {
    const me = await authedUserId();
    if (!me) return { ok: false as const, error: "Sign in required" };

    const { data, error } = await supabaseAdmin.rpc("evaluate_badges_for", {
      _user_id: me,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, earned: data ?? [] };
  });

/** Manually grant a "fun" badge to self (early bird, night owl). */
export const claimFunBadge = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ badge_key: z.enum(["night_owl", "early_bird"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await authedUserId();
    if (!me) return { ok: false as const, error: "Sign in required" };

    const hour = new Date().getUTCHours();
    if (data.badge_key === "night_owl" && (hour < 0 || hour > 5)) {
      return { ok: false as const, error: "Come back after midnight." };
    }
    if (data.badge_key === "early_bird" && hour > 6) {
      return { ok: false as const, error: "Come back before 6am." };
    }

    const { error } = await supabaseAdmin
      .from("user_badges")
      .insert({ user_id: me, badge_key: data.badge_key })
      .select()
      .single();
    if (error && !error.message.includes("duplicate")) {
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });
