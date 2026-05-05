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

## Agency delivery layer (in progress)
1. ✅ **Sprints v1** — schema + planning mode + capacity stats
2. ✅ **Resources v1** — team_members + time_logs schema, capacity grid in Settings → Resources
3. Resources v2 — per-task estimates feeding allocation, smart auto-assign by skill
4. ✅ **Milestones v1** — schema + timeline view with delivery/payment/gate/review types
5. Milestones v2 — Gantt-style chart, dependencies, auto status from sprint/task progress
6. ✅ **Financials v1** — project_financials table, margin/burn/payment dashboard at /financials
7. ✅ **Delivery health v1** — weighted 5-dimension score with radar chart, flags & suggested actions at /health
8. (deferred) Client portal

## Other
4. **Comparison page** ("Aura vs Notion / Asana / Monday")
5. **Meetings**: speaker attribution + decision log dedicated tab
6. **Timeline**: dependency lines (use task_relations) + critical path highlight
7. **Mobile**: dedicated quick-capture for meetings
8. **Templates marketplace** for Workflow templates

## Tech debt
- Consolidate hero `<a href="#...">` anchors → `<Link to="/...">` everywhere
- Shared `<MarketingHeader />` / `<MarketingFooter />` components
- Add OG images per marketing route once design lands
