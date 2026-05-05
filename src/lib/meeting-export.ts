import type { Meeting, MeetingActionItem } from "./meeting-types";

function bullets(items: string[] | undefined): string {
  if (!items || items.length === 0) return "_None_\n";
  return items.map((i) => `- ${i}`).join("\n") + "\n";
}

export function meetingToMarkdown(
  meeting: Meeting,
  actionItems: MeetingActionItem[],
  projectName?: string | null,
): string {
  const s = meeting.summary;
  const lines: string[] = [];

  lines.push(`# ${meeting.title}`);
  lines.push("");
  const meta: string[] = [];
  meta.push(`**Created:** ${new Date(meeting.created_at).toLocaleString()}`);
  if (projectName) meta.push(`**Project:** ${projectName}`);
  if (meeting.ai_model) meta.push(`**Model:** ${meeting.ai_model}`);
  if (meeting.participant_emails?.length)
    meta.push(`**Participants:** ${meeting.participant_emails.join(", ")}`);
  lines.push(meta.join("  \n"));
  lines.push("");

  if (s?.overview) {
    lines.push("## Overview");
    lines.push(s.overview);
    lines.push("");
  }

  if (s?.key_points?.length) {
    lines.push("## Key points");
    lines.push(bullets(s.key_points));
  }

  if (s?.decisions?.length) {
    lines.push("## Decisions");
    lines.push(bullets(s.decisions));
  }

  if (s?.risks?.length) {
    lines.push("## Risks");
    lines.push(bullets(s.risks));
  }

  if (s?.questions_unanswered?.length) {
    lines.push("## Open questions");
    lines.push(bullets(s.questions_unanswered));
  }

  if (actionItems.length > 0) {
    lines.push("## Action items");
    for (const a of actionItems) {
      const parts: string[] = [];
      const checked = a.status === "completed" || a.status === "converted" ? "x" : " ";
      parts.push(`- [${checked}] ${a.summary ?? a.original_text}`);
      const tags: string[] = [];
      if (a.assignee_guess_name) tags.push(`@${a.assignee_guess_name}`);
      if (a.due_guess) tags.push(`due ${a.due_guess}`);
      if (a.priority_guess && a.priority_guess !== "medium") tags.push(a.priority_guess);
      if (tags.length) parts.push(` _(${tags.join(", ")})_`);
      lines.push(parts.join(""));
      if (a.context_quote) lines.push(`  > ${a.context_quote}`);
    }
    lines.push("");
  }

  if (meeting.topics?.length) {
    lines.push("## Topics");
    lines.push(meeting.topics.map((t) => `- ${t.name}${t.sentiment ? ` _(${t.sentiment})_` : ""}`).join("\n"));
    lines.push("");
  }

  if (s?.sentiment) {
    lines.push(`_Overall sentiment: ${s.sentiment}_`);
  }

  return lines.join("\n");
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^a-z0-9-_. ]/gi, "_") + ".md";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
