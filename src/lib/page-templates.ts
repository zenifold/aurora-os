import type { PageType } from "./page-types";

export interface PageTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  page_type: PageType;
  category: "agile" | "planning" | "product" | "ops" | "general";
  content: unknown;
}

const doc = (nodes: unknown[]) => ({ type: "doc", content: nodes });
const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const p = (text = "") => (text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" });
const bullets = (items: string[]) => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] })),
});
const tasks = (items: string[]) => ({
  type: "taskList",
  content: items.map((t) => ({ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] })),
});

export const BUILTIN_TEMPLATES: PageTemplate[] = [
  {
    id: "sprint_retro",
    label: "Sprint Retrospective",
    icon: "🔁",
    description: "What went well, what didn't, action items for next sprint.",
    page_type: "doc",
    category: "agile",
    content: doc([
      h(1, "Sprint Retrospective"),
      p("Sprint: __  ·  Date: __  ·  Facilitator: __"),
      h(2, "🌟 What went well"),
      bullets(["…"]),
      h(2, "🌧️ What didn't go well"),
      bullets(["…"]),
      h(2, "💡 Ideas to try"),
      bullets(["…"]),
      h(2, "✅ Action items"),
      tasks(["Owner — action — due"]),
    ]),
  },
  {
    id: "sprint_planning",
    label: "Sprint Planning",
    icon: "🎯",
    description: "Goal, capacity, scope, risks.",
    page_type: "plan",
    category: "agile",
    content: doc([
      h(1, "Sprint Planning"),
      h(2, "Sprint goal"),
      p(),
      h(2, "Capacity"),
      bullets(["Team capacity (hrs):", "Holidays / OOO:"]),
      h(2, "Committed scope"),
      tasks(["…"]),
      h(2, "Risks"),
      bullets(["…"]),
    ]),
  },
  {
    id: "standup",
    label: "Daily Standup",
    icon: "☕",
    description: "Yesterday / today / blockers.",
    page_type: "meeting_notes",
    category: "agile",
    content: doc([
      h(1, "Daily Standup"),
      p("Date: __"),
      h(3, "Yesterday"),
      bullets(["…"]),
      h(3, "Today"),
      bullets(["…"]),
      h(3, "Blockers"),
      bullets(["…"]),
    ]),
  },
  {
    id: "prd",
    label: "Product Requirements Doc",
    icon: "📋",
    description: "Problem, users, requirements, success metrics.",
    page_type: "prd",
    category: "product",
    content: doc([
      h(1, "PRD: __"),
      h(2, "Summary"),
      p(),
      h(2, "Problem"),
      p(),
      h(2, "Users & use cases"),
      bullets(["…"]),
      h(2, "Requirements"),
      bullets(["Must:", "Should:", "Could:"]),
      h(2, "Success metrics"),
      bullets(["…"]),
      h(2, "Open questions"),
      bullets(["…"]),
    ]),
  },
  {
    id: "kickoff",
    label: "Project Kickoff",
    icon: "🚀",
    description: "Goals, stakeholders, scope, timeline, risks.",
    page_type: "doc",
    category: "planning",
    content: doc([
      h(1, "Project Kickoff"),
      h(2, "Goals & success criteria"),
      bullets(["…"]),
      h(2, "Stakeholders"),
      bullets(["Sponsor:", "Lead:", "Team:", "Client:"]),
      h(2, "Scope"),
      bullets(["In:", "Out:"]),
      h(2, "Timeline & milestones"),
      bullets(["…"]),
      h(2, "Risks"),
      bullets(["…"]),
      h(2, "Next steps"),
      tasks(["…"]),
    ]),
  },
  {
    id: "decision_log",
    label: "Decision Log",
    icon: "🧭",
    description: "Context, options, decision, consequences.",
    page_type: "decision",
    category: "general",
    content: doc([
      h(1, "Decision: __"),
      h(2, "Context"),
      p(),
      h(2, "Options considered"),
      bullets(["A — pros / cons", "B — pros / cons"]),
      h(2, "Decision"),
      p(),
      h(2, "Consequences"),
      bullets(["…"]),
    ]),
  },
  {
    id: "one_on_one",
    label: "1:1 Notes",
    icon: "🤝",
    description: "Recurring 1:1 agenda + action items.",
    page_type: "meeting_notes",
    category: "general",
    content: doc([
      h(1, "1:1 — __"),
      h(3, "Wins"),
      bullets(["…"]),
      h(3, "Challenges"),
      bullets(["…"]),
      h(3, "Feedback"),
      bullets(["…"]),
      h(3, "Action items"),
      tasks(["…"]),
    ]),
  },
  {
    id: "runbook",
    label: "Incident Runbook",
    icon: "📕",
    description: "Step-by-step on-call playbook.",
    page_type: "runbook",
    category: "ops",
    content: doc([
      h(1, "Runbook: __"),
      h(2, "When to use"),
      p(),
      h(2, "Detection"),
      bullets(["…"]),
      h(2, "Mitigation steps"),
      tasks(["Step 1", "Step 2"]),
      h(2, "Communication"),
      bullets(["Slack channel:", "Status page:"]),
      h(2, "Postmortem"),
      p(),
    ]),
  },
  {
    id: "blank",
    label: "Blank page",
    icon: "📄",
    description: "Start from scratch.",
    page_type: "doc",
    category: "general",
    content: doc([p()]),
  },
];

export const PAGE_TEMPLATES = BUILTIN_TEMPLATES;

