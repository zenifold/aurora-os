# Aura — The Company OS for Agencies & Software Delivery Teams

> **Sales → Delivery → Ops, all in one place.**
> Aura replaces the patchwork of Jira, Linear, Notion, HubSpot, Fathom, Asana, and Harvest with a single, opinionated workspace built for agencies and software delivery teams.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-ff69b4.svg)](https://lovable.dev)

---

## ✨ What is Aura?

Aura is an open-source **Company OS** that unifies the full lifecycle of client and product work:

- 🎯 **Sales** — Pipeline, proposals, SOWs, forecasting
- 🚀 **Delivery** — Sprints, tasks, milestones, client portals, deliverables
- 📊 **Ops** — Resourcing, financials, margins, escalations, PMO governance
- 🧠 **Knowledge** — Notes, meetings (with AI transcription/summary), documents

It replaces:

| Category | Tool you can drop |
|---|---|
| Project mgmt | Jira, Linear, Asana |
| Docs / wiki | Notion, Confluence |
| Meetings | Fathom, Otter |
| CRM / Sales | HubSpot (lite), Pipedrive |
| Time / billing | Harvest, Toggl |

## 🧩 Core features

- **Multi-view workspace** — Table, Kanban, Timeline, Calendar, Canvas, **Sprint** (with backlog grooming + capacity)
- **Project Overview hub** — Notion-style hierarchical landing page per project
- **Client portal** — Magic-link access for clients to review deliverables and sign off
- **Sprint planning** — Backlog → Grooming → Next Sprint → Active, with drag-and-drop and capacity tracking
- **Financials** — Contract value, burn, margin tracking, target margins per project
- **Health & escalations** — Tiered automated escalations (L1 → L5)
- **Magic Add** — One input creates the right entity (task, note, meeting, etc.) with AI
- **Realtime collaboration** — Presence, comments, mentions
- **PWA** — Installable, offline-aware
- **AI built-in** — Powered by the [Lovable AI Gateway](https://docs.lovable.dev) (Gemini, GPT-5)

## 🏗️ Tech stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19 + Vite 7) with SSR on Cloudflare Workers
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) via [Lovable Cloud](https://lovable.dev/cloud)
- **Styling:** Tailwind CSS v4 + shadcn/ui + Radix
- **State:** Zustand + TanStack Query (with persist)
- **Editor:** Tiptap
- **AI:** Lovable AI Gateway

## 🚀 Quick start

### Prerequisites
- [Bun](https://bun.sh/) (or Node 20+)
- A Supabase project (or use Lovable Cloud)

### Install

```bash
git clone https://github.com/<your-org>/aura.git
cd aura
bun install
```

### Configure

Copy `.env.example` to `.env` and fill in:

```bash
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<your-ref>
```

### Run migrations

All schema lives in `supabase/migrations/`. Apply with the Supabase CLI:

```bash
supabase db push
```

### Develop

```bash
bun dev
```

Open <http://localhost:3000>.

### Build

```bash
bun run build
```

Output deploys to Cloudflare Workers (see `wrangler.jsonc`) or any edge host that supports TanStack Start.

## 🗂️ Project structure

```
src/
  routes/            # File-based routes (TanStack Router)
    app.*            # Authenticated app routes
    api/public/*     # Public webhook / portal endpoints
  components/
    app/             # App chrome (header, sidebar, palette, magic add)
    views/           # Table, Kanban, Timeline, Canvas, Calendar, Sprint
    projects/        # Project hub, settings, workflow builder
    tasks/           # Task detail, comments, relations, AI panel
    notes/, meetings/, ui/
  hooks/             # React Query hooks for each domain
  lib/               # Types, helpers, workflow engine
  server/            # createServerFn + *.server.ts (server-only)
  integrations/supabase/
  stores/            # Zustand stores
supabase/
  migrations/        # SQL migrations
  config.toml
```

## 🧭 Roadmap

- [x] Multi-view workspace + custom fields
- [x] Sprint view with backlog grooming
- [x] Client portal & deliverables review
- [x] Financials, health, change orders
- [x] Magic Add (AI entity creation)
- [ ] Escalation engine (L1–L5 tiered automation)
- [ ] Proposal → Project auto-conversion
- [ ] Executive rollup dashboard
- [ ] Mobile native shells

See [docs/architecture.md](docs/architecture.md) for the full vision.

## 🤝 Contributing

We love contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

Quick path:
1. Fork & branch (`feat/your-thing`)
2. `bun install && bun dev`
3. Open a PR with a clear description and screenshots if UI

## 🔒 Security

Found a vulnerability? Please email **security@<your-domain>** instead of opening an issue. See [SECURITY.md](SECURITY.md).

## 📜 License

[MIT](LICENSE) © Aura contributors.

## 🙌 Built with

- [Lovable](https://lovable.dev) — AI-powered app builder used to scaffold and iterate Aura
- [TanStack](https://tanstack.com), [Supabase](https://supabase.com), [shadcn/ui](https://ui.shadcn.com)
