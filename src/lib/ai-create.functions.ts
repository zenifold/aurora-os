import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const generateArtifact = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        workspace_id: z.string().uuid(),
        folder_id: z.string().uuid().nullable().optional(),
        kind: z.enum(["folder", "page", "canvas", "plan", "project", "auto"]),
        mode: z.enum(["one_shot", "agentic"]),
        prompt: z.string().min(3).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { authedUserId, getApiKey, runArtifactGeneration } = await import("@/server/ai-create.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const userId = await authedUserId();
    if (!userId) return { error: "Not signed in" } as const;

    const { data: member } = await supabaseAdmin
      .from("user_roles")
      .select("workspace_id")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) return { error: "Not a workspace member" } as const;

    const apiKey = await getApiKey(data.workspace_id);
    if (!apiKey)
      return {
        error: "No OpenRouter API key configured. Add one in Settings → AI agents.",
      } as const;

    const result = await runArtifactGeneration({
      workspace_id: data.workspace_id,
      user_id: userId,
      division_id: "",
      folder_id: data.folder_id ?? null,
      kind: data.kind,
      mode: data.mode,
      prompt: data.prompt,
      apiKey,
    });
    return result;
  });
