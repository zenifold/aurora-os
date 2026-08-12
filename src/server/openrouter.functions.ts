import { createServerFn } from "@tanstack/react-start";

export type OpenRouterModel = {
  id: string;
  name: string;
  context_length: number | null;
  pricing: { prompt: string; completion: string } | null;
  description: string | null;
};

/**
 * Fetch the OpenRouter model catalog. Public endpoint — no auth required.
 * Cached on the response with Cache-Control to keep load light.
 */
export const listOpenRouterModels = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ models: OpenRouterModel[]; error: string | null }> => {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "HTTP-Referer": "https://github.com/zenifold/aurora-os", "X-Title": "Aurora" },
      });
      if (!res.ok) {
        return { models: [], error: `OpenRouter ${res.status}` };
      }
      const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
      const models: OpenRouterModel[] = (json.data ?? []).map((m) => ({
        id: String(m.id),
        name: String(m.name ?? m.id),
        context_length:
          typeof m.context_length === "number" ? (m.context_length as number) : null,
        pricing:
          m.pricing && typeof m.pricing === "object"
            ? {
                prompt: String((m.pricing as Record<string, unknown>).prompt ?? "0"),
                completion: String(
                  (m.pricing as Record<string, unknown>).completion ?? "0",
                ),
              }
            : null,
        description: typeof m.description === "string" ? (m.description as string) : null,
      }));
      // Sort: by name
      models.sort((a, b) => a.name.localeCompare(b.name));
      return { models, error: null };
    } catch (e) {
      console.error("OpenRouter model fetch failed:", e);
      return { models: [], error: "Failed to load OpenRouter models" };
    }
  },
);
