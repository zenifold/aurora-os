# Aura — Roadmap

## Just shipped
- Workflow builder phase 2 (transitions, templates, status history)
- Meetings v1 (transcript, AI analysis, action items, project linking, markdown export, filters)
- Project notes wiki integration
- Timeline scenario planning + named snapshots + per-task overrides
- Custom field type: Level of Effort (drives timeline scenarios)

## Open-source pivot (this iteration)
- Reframe landing: positioning, OSS, BYO OpenRouter key, escape from expensive SaaS
- Dedicated marketing routes: `/features`, `/how-it-works`, `/pricing`
- Shared marketing chrome (Navbar / Footer) extracted from index
- New pricing model: Free self-hosted • Hosted Cloud • Team support

## Next up
1. **Self-host docs route** (`/docs/self-host`) — clone repo, env, deploy steps
2. **OpenRouter key onboarding** — first-run modal in app pointing user to add their key in Settings → AI
3. **GitHub repo link + star CTA** in nav and footer
4. **Comparison page** ("Aura vs Notion / Asana / Monday")
5. **Meetings**: speaker attribution + decision log dedicated tab
6. **Timeline**: dependency lines (use task_relations) + critical path highlight
7. **Mobile**: dedicated quick-capture for meetings
8. **Templates marketplace** for Workflow templates

## Tech debt
- Consolidate hero `<a href="#...">` anchors → `<Link to="/...">` everywhere
- Shared `<MarketingHeader />` / `<MarketingFooter />` components
- Add OG images per marketing route once design lands
