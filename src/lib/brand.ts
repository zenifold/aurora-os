/**
 * Brand / white-label configuration.
 *
 * Resolution order (first non-empty wins):
 *   1. Workspace-level overrides stored in `workspaces.branding` (jsonb)
 *   2. Build-time env vars (VITE_BRAND_*)
 *   3. Hard-coded defaults in DEFAULT_BRAND
 *
 * Use the `useBrand()` hook in components to get the merged config for the
 * current workspace. Use `getDefaultBrand()` in unauthenticated / marketing
 * pages where there is no workspace context.
 */

export interface BrandConfig {
  /** App / product name shown in the UI, page titles, emails. */
  appName: string;
  /** Short name (PWA, mobile). */
  shortName: string;
  /** One-line tagline used in marketing meta tags. */
  tagline: string;
  /** Longer description for og: meta. */
  description: string;
  /** Public marketing site URL (for emails, footer). */
  marketingUrl: string;
  /** Support / contact email. */
  supportEmail: string;
  /** Public source-code URL. Empty hides GitHub links. */
  githubUrl: string;
  /** Optional workspace logo override (otherwise gradient mark is used). */
  logoUrl: string | null;
  /** Hide the marketing site routes (/, /features, /pricing) entirely. */
  hideMarketing: boolean;
  /** Hide the footer "Built with..." / source-code attribution. */
  hideAttribution: boolean;
}

const env = (key: string): string | undefined => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const v = (import.meta.env as Record<string, string | undefined>)[key];
    if (v && v.length) return v;
  }
  return undefined;
};

export const DEFAULT_BRAND: BrandConfig = {
  appName: env("VITE_BRAND_APP_NAME") ?? "Aurora",
  shortName: env("VITE_BRAND_SHORT_NAME") ?? env("VITE_BRAND_APP_NAME") ?? "Aurora",
  tagline:
    env("VITE_BRAND_TAGLINE") ??
    "The company OS for agencies & software delivery teams",
  description:
    env("VITE_BRAND_DESCRIPTION") ??
    "Sales, delivery, and operations in one workspace. Open source, bring your own AI key.",
  marketingUrl: env("VITE_BRAND_MARKETING_URL") ?? "",
  supportEmail: env("VITE_BRAND_SUPPORT_EMAIL") ?? "",
  githubUrl: env("VITE_BRAND_GITHUB_URL") ?? "https://github.com/zenifold/aurora-os",
  logoUrl: null,
  hideMarketing: env("VITE_BRAND_HIDE_MARKETING") === "true",
  hideAttribution: env("VITE_BRAND_HIDE_ATTRIBUTION") === "true",
};

export function getDefaultBrand(): BrandConfig {
  return { ...DEFAULT_BRAND };
}

/**
 * Merge a workspace `branding` jsonb blob over the defaults.
 * Empty/null values in the override are ignored.
 */
export function mergeBrand(
  override: Partial<BrandConfig> | null | undefined,
): BrandConfig {
  const base = getDefaultBrand();
  if (!override) return base;
  const out = { ...base };
  for (const key of Object.keys(override) as (keyof BrandConfig)[]) {
    const v = override[key];
    if (v === null || v === undefined || v === "") continue;
    // @ts-expect-error narrow union assignment
    out[key] = v;
  }
  return out;
}
