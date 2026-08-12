# Contributing to Aura

Thanks for your interest in making Aura better. This guide explains how to set up your environment, the conventions we follow, and how to ship a great pull request.

## Code of Conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). Be kind, be curious, assume good intent.

## Ways to contribute

- 🐛 **Bugs** — Open an issue using the bug template with steps to reproduce.
- 💡 **Feature ideas** — Open a discussion or feature-request issue first; we'd rather align on shape before code.
- 📝 **Docs** — Typos, clarifications, examples, screenshots all welcome.
- 🧪 **Tests** — Increasing coverage on hooks, server functions, and workflow logic is always appreciated.
- 🎨 **Design** — Token tweaks, accessibility fixes, polish.

## Development setup

```bash
bun install
cp .env.example .env   # fill in Supabase keys
bun dev
```

- Node 20+ or Bun 1.1+
- A Supabase project (free tier is fine)
- Run `supabase db push` to apply migrations from `supabase/migrations/`

## Project conventions

### Stack
- **TanStack Start** for routes and SSR — file-based routes in `src/routes/`
- **Server functions** live in `src/server/*.functions.ts`; server-only helpers in `*.server.ts`
- **Supabase** is wrapped via `src/integrations/supabase/client.ts` — never edit that file or `types.ts` (auto-generated)
- **State**: TanStack Query for server state, Zustand for UI state
- **Styles**: Tailwind v4 + shadcn/ui + semantic tokens in `src/styles.css` — **never hardcode colors** in components

### Database
- All schema changes go through `supabase/migrations/` SQL files
- Every table needs RLS policies — no exceptions
- Roles live in a separate `user_roles` table (never on `profiles`)

### Code style
- TypeScript strict mode is on; no `any` without comment
- Prefer small, focused components and hooks
- Run `bun run lint` and `bun run format` before pushing

### Commits & branches
- Branch names: `feat/...`, `fix/...`, `docs/...`, `chore/...`
- Conventional commits encouraged (`feat:`, `fix:`, `docs:`...)
- Squash-merge by default; PR title becomes the commit

## Pull request checklist

- [ ] Linked issue (or clear description if trivial)
- [ ] Screenshots / screen recordings for UI changes
- [ ] Migrations included if schema changed
- [ ] RLS policies added/updated for new tables
- [ ] No new ESLint or TS errors
- [ ] Docs updated if behavior changed

## Reporting security issues

**Do not open public issues for vulnerabilities.** See [SECURITY.md](SECURITY.md).

## Questions?

Open a [GitHub Discussion](https://github.com/) or join the chat (link in README). We're happy to help you get unstuck.
