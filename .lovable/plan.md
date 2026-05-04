# Aura — Phase 1 Build Plan

A focused first cut: get a real user signing in, creating a workspace and projects, and managing tasks in a fast Airtable-style Table view. Kanban and Canvas come in later phases on top of this same foundation.

## What we're shipping

1. **Auth** — Email/password + Google via Lovable Cloud
2. **Onboarding** — Solo vs Team choice on signup
3. **Workspaces** — Multi-tenant with Owner/Member roles
4. **Projects** — Create, rename, color, archive, nested folders (up to 3 levels)
5. **Tasks** — Full CRUD with status, priority, assignee, due date, tags
6. **Custom fields** — Text, Number, Date, Select, Multi-select, Checkbox, User, URL
7. **Table view** — Inline editing, sort, filter, group, saved views
8. **App shell** — Sidebar, workspace switcher, Cmd+K search, dark mode

## Brand & design

- **Name:** Aura
- **Identity:** Rainbow gradient (indigo → purple → pink → orange) on accents, buttons, active states, brand mark
- **Surfaces:** Clean white with slate-200 borders; deep charcoal in dark mode with muted rainbow accents
- **Status colors:** slate (todo), blue (in progress), amber (review), green (done), red (cancelled)
- **Type:** Geist sans, mono for IDs/dates
- **Shape:** rounded-xl corners, subtle shadows, 200ms transitions

## User flows

### Signup → onboarding
1. Land on marketing-ish login page with rainbow mesh background
2. Sign up via email/password or Google
3. Choose path: **"I'm starting solo"** (auto-creates personal workspace + seeded demo project with sample tasks) or **"I'm setting up a team"** (workspace name + slug form)
4. Land in workspace with sidebar + first project open

### Daily use
- Sidebar: workspace switcher, project tree, My Tasks, Settings
- Click project → Table view of tasks loads
- Click any cell to edit inline; Tab/Enter/Esc behave like a spreadsheet
- Add column button → pick field type → appears immediately
- Filter bar: stack filters (field + operator + value), sort, group by
- Save current configuration as a named view; switch views via tabs above table
- Click row → task detail slide-over from right (description, subtasks, comments, activity)
- Cmd+K opens global task/project search

### Team & permissions
- Settings → Members: invite by email, assign Owner or Member role
- Owner: full control (billing, members, delete workspace)
- Member: create/edit projects and tasks, cannot manage members or delete workspace
- Invites send a link; recipient signs up/in and joins the workspace

## Data model (Lovable Cloud)

```text
workspaces        id, name, slug, owner_id, plan, settings, timestamps
workspace_members workspace_id, user_id, role (owner|member), joined_at
profiles          id (= auth user), display_name, avatar_url, timezone
user_roles        user_id, workspace_id, role  ← separate table per security rules
projects          id, workspace_id, name, color, icon, parent_id, archived, created_by
custom_field_defs id, workspace_id, name, field_type, options, order_index
tasks             id, project_id, workspace_id, title, description (jsonb),
                  status, priority, assignee_ids[], due_date, start_date,
                  parent_task_id, custom_values (jsonb), tags[], position,
                  created_by, timestamps, completed_at
views             id, project_id, workspace_id, name, view_type ('table'),
                  config, filters, sorts, is_default
comments          id, task_id, author_id, content (jsonb), parent_id
activity_log      workspace_id, actor_id, entity_type, entity_id, action, changes
```

RLS on every table scoped by workspace membership. Roles checked through a `has_role(user_id, workspace_id, role)` security-definer function to avoid recursion. Tasks/projects readable by all members; mutations gated by role where appropriate.

## Pages & routes

```text
/                       Marketing/landing → redirects to /app if signed in
/login                  Sign in (email + Google)
/signup                 Sign up
/onboarding             Solo vs Team picker → workspace creation
/app                    Authenticated shell (sidebar + outlet)
  /app/                 Default → My Tasks
  /app/p/$projectId     Project page (Table view)
  /app/p/$projectId/v/$viewId  Specific saved view
  /app/my-tasks         Tasks assigned to me across workspace
  /app/settings         Workspace settings (general)
  /app/settings/members Members & invitations
  /app/settings/fields  Custom field definitions
  /app/settings/profile User profile
```

## Components (high level)

- `AppSidebar` — workspace switcher, project tree with drag-reorder, nav items
- `AppHeader` — breadcrumb, Cmd+K search trigger, notifications, user menu
- `ProjectTree` — recursive nested folder/project list with context menu
- `TableView` — virtualized grid, inline editors per field type
- `FilterBar` — stackable filter chips, sort menu, group-by menu, view tabs
- `TaskDetailPanel` — slide-over with title, rich description (TipTap), properties grid, subtasks, comments, activity
- `CustomFieldCell` — dispatches by field_type to the right editor
- `InvitePeopleModal` — email + role
- `CommandPalette` — Cmd+K fuzzy search across tasks/projects

## Out of scope for this build (deferred)

- Kanban, Canvas, Calendar, Timeline views
- Automations engine
- Stripe billing & paid plans
- Email notifications & digests
- Realtime multi-cursor presence
- Mobile-native wrapper
- Audit log UI (data is logged, no viewer yet)
- Attachments (schema ready, upload UI later)

These are explicitly designed-for in the schema so they slot in cleanly later.

## Technical notes

- **Stack:** TanStack Start (already set up), Lovable Cloud (Supabase) for DB/auth/storage, TanStack Query for server state, Zustand for UI/selection state, TipTap for rich text, dnd-kit for sidebar reordering
- **Auth:** Email/password + Google via Lovable Cloud. `_authenticated` layout route gates `/app/*` with `beforeLoad` redirect to `/login`
- **Roles in a separate `user_roles` table** with a `has_role()` security-definer function — never store roles on profiles
- **Server functions** (`createServerFn` + `requireSupabaseAuth`) for any privileged ops; browser Supabase client for normal RLS-respecting reads
- **Custom field values** live as `jsonb` on tasks keyed by field id; client renders cells dynamically by `field_type`
- **Filters/sorts** evaluated client-side over a React Query cache for snappy UX; persisted on the view record
- **Optimistic updates** on every task mutation, rollback on error with a toast
- **Seed data** for solo onboarding: one "Welcome to Aura" project with ~8 demo tasks across statuses

After approval I'll start with auth + the database schema, then the app shell, then the Table view end-to-end.