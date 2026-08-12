# Self-hosting & white-labeling

This project is MIT licensed and designed to be deployable on your own
infrastructure with your own branding.

## 1. Prerequisites

- [Bun](https://bun.sh) (or Node 20+)
- A Supabase project (or self-hosted Supabase)
- An [OpenRouter](https://openrouter.ai) API key (optional, for AI features)

## 2. Clone & install

```bash
git clone <your-fork-url> my-company-os
cd my-company-os
npm install   # or: bun install
cp .env.example .env
```

## 3. Configure environment

Fill in `.env` with your Supabase project credentials. See `.env.example`
for the full list. The `VITE_BRAND_*` variables let you change the app
name, tagline, and support links at build time without touching code.

## 4. Run database migrations

```bash
supabase link --project-ref <your-ref>
supabase db push
```

This applies every SQL migration in `supabase/migrations/`, including
storage buckets, RLS policies, and triggers.

> **Migrating off Lovable Cloud?** Three scheduled jobs and one column default
> created by these migrations still point at the old Lovable deployment, and
> applying the migrations as-is reproduces them. See
> [de-lovable-db.md](de-lovable-db.md) for what they are and the SQL to
> repoint them at your own origin.

## 5. Start in dev

```bash
npm run dev   # or: bun dev
```

Open http://localhost:5173. Vite takes ~55s to boot this project — wait for the
`ready in …` line before loading the page. Override the port with `PORT=8090 npm run dev`.

## 6. Deploy

The repo ships with a `wrangler.jsonc` for Cloudflare Workers. Any host
that supports TanStack Start (Vercel, Fly, Netlify Edge, your own Node
server) will work too.

Configuration splits in two, and mixing them up is the most common deploy failure:

| Vars | Delivered how | When it takes effect |
|------|---------------|----------------------|
| `VITE_*` (Supabase URL, publishable key, `VITE_BRAND_*`) | `.env.production`, inlined into the bundle | at build time |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `wrangler secret put` | at runtime |
| `OPENROUTER_API_KEY` | `wrangler secret put` — **optional fallback only**, see below | at runtime |

The worker bundle has no `process.env` for client-visible config, so `VITE_*` values are
baked in by `vite build` (see the `define` block in `vite.config.ts`). **Changing one
requires a rebuild and redeploy, not just a secret update.** Never put the service-role
key in a `VITE_*` var — it would ship to the browser.

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put OPENROUTER_API_KEY   # optional — see "AI keys are per workspace"

npm run build
npm run deploy
```

### AI keys are per workspace

OpenRouter keys are tenant-scoped, not deployment-scoped. Each workspace stores
its own key in `workspace_ai_secrets`, set by owners under **Settings → AI**.
Every AI feature resolves it through `resolveOpenRouterKey(workspaceId)` in
`src/server/openrouter-key.server.ts` — the single place that reads a key.

`OPENROUTER_API_KEY` is only a deployment-wide fallback, used when a workspace
has not configured one. It exists to ease migration and can be dropped entirely
once every workspace sets its own key. There is deliberately no per-user key:
`workspace_ai_secrets.updated_by` records *who* set it, and is not a second tier
of resolution.

`npm run deploy` runs `wrangler deploy -c dist/server/wrangler.json`. The `-c` matters:
`vite build` generates that config with the static-assets binding
(`"assets": {"directory": "../client"}`), which the root `wrangler.jsonc` does not have.
Deploying against the root config ships the server without the client bundle.

To serve from a custom domain, set `routes` in `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "your-domain.com", "custom_domain": true }]
```

## 7. White-label

Two layers of branding control:

### Build-time (applies to marketing site, page titles, PWA, emails)

Set `VITE_BRAND_*` env vars at build time. Examples:

```bash
VITE_BRAND_APP_NAME=Acme OS
VITE_BRAND_TAGLINE="The operating system for Acme"
VITE_BRAND_SUPPORT_EMAIL=hello@acme.com
VITE_BRAND_GITHUB_URL=
VITE_BRAND_HIDE_MARKETING=true
VITE_BRAND_HIDE_ATTRIBUTION=true
```

Setting `VITE_BRAND_GITHUB_URL=` (empty) hides all GitHub links from the
footer and how-it-works page.

### Runtime per-workspace (applies inside the app)

Each workspace has a `branding` jsonb column. Workspace owners can edit
the app name, tagline, support email, and source-code links from
**Settings → Workspace → White-label branding**.

Logo is uploaded separately to the `workspace-logos` bucket from the
same settings page.

## 8. AI key (optional)

Without an `OPENROUTER_API_KEY`, AI features (meeting analysis, magic
add, agents) are disabled but the rest of the app works. Either:

- Set `OPENROUTER_API_KEY` as a server secret in your Supabase project, or
- Have each workspace owner paste their own key in **Settings → AI**.

## 9. Auth providers

Email/password + Google are enabled by default. Configure additional
providers (Apple, SAML, Microsoft) in your Supabase dashboard under
**Authentication → Providers**.

## 10. Storage

These buckets are created by the migrations:

| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | yes | User profile pictures |
| `workspace-logos` | yes | Workspace logos |
| `project-documents` | no | Per-project files |
| `client-deliverables` | no | Files shared via the client portal |
| `meeting-recordings` | no | Audio uploaded by the meeting recorder |

## Need help?

Open an issue at the upstream repo or your fork. PRs welcome.
