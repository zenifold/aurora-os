# What's Left — Aura Roadmap

The folder architecture vertical slice, sidebar tree, skeletons, and assignee picker (humans + AI agents) are in. Here's a prioritized plan for what still needs work.

---

## 1. Folder Architecture — Finish the Loop

**1a. Folder detail page polish (`/app/f/$folderId`)**
- Tabbed view: Overview · Projects · Tasks · Notes · Files · Activity
- Inline rename, color/icon picker, description editor
- Move folder (change parent) via dialog or drag
- Archive / delete with confirm + cascade preview

**1b. Division landing pages (`/app/d/$divisionSlug`)**
- KPI strip (open projects, overdue tasks, this-week activity)
- Folder grid + recently-touched
- Division settings: rename, icon, color, sort order

**1c. Project ↔ Folder linking**
- Move project between folders (single + bulk)
- Show folder path on project header
- "Unfiled" bucket for orphaned projects

**1d. Workspace presets**
- Onboarding picker (Agency / Shop / Software / Consulting / Custom)
- Seed divisions, sample folders, default workflows
- Stored as `workspace_presets` for re-application

---

## 2. Tasks — Catch up to the new model

- **Folder/Project assignment** on task create (currently flat)
- **Multi-assignee**: humans + agents on the same task with role chips
- **Subtasks** (parent_task_id already exists?) — verify schema and surface in UI
- **Task templates** per folder / division
- **Bulk actions**: status, assignee, due date, move folder
- **Saved views / filters** (My open, Overdue, By folder)

---

## 3. AI Agents — Productionize

- **Agent runs panel** on task: live log, retry, cancel, cost
- **Approval gates** for destructive actions
- **Agent library**: pre-built agents (Researcher, Drafter, Reviewer, Triage)
- **Per-folder default agents** (auto-assign on task create)
- **Usage dashboard**: tokens, runs, cost per workspace/division

---

## 4. Navigation & Header

- **Command palette** (⌘K): jump to folder/project/task, run actions
- **Global search** across folders, projects, tasks, notes
- **Breadcrumbs** consistent on every detail page
- **Recents** + **Pinned** in sidebar

---

## 5. Realtime & Collaboration

- Realtime updates on folder tree, task lists, kanban
- Presence indicators (who's viewing this folder/project)
- Comments + @mentions on tasks and notes
- Notification preferences per division/folder

---

## 6. Permissions

- Workspace roles already in place — extend to **folder-level roles** (viewer/editor/owner)
- Hide folders user can't see in the sidebar tree
- RLS policies on `folders`, `folder_favorites`, `folder_tree_state`

---

## 7. Polish & UX

- Empty states for every page (folder, division, tasks, CRM)
- Error boundaries on all routes (currently inconsistent)
- Mobile responsive pass on sidebar tree + folder pages
- Keyboard shortcuts (j/k navigate, e edit, # tag, etc.)
- Toast → action-redo pattern on destructive ops

---

## 8. Data & Ops

- Migration: assign existing projects/tasks to default folders (currently all under Delivery)
- Seed script for demo workspace
- Audit log table for folder/project/task changes
- Soft delete + restore for folders and projects

---

## Suggested order

Pick one of these chunks to tackle next — I'd recommend in this order for highest leverage:

1. **Folder detail page polish (1a)** — folders feel half-built without it
2. **Project ↔ Folder linking (1c)** — unblocks real usage
3. **Command palette + global search (4)** — multiplies everything
4. **Workspace presets (1d)** — onboarding story
5. **Agent runs panel (3)** — makes AI assignment visible

Tell me which chunk(s) to do next and I'll implement.
