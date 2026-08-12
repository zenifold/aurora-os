// Maps the current router state to a structured "what is the user viewing"
// context that the Aura assistant uses to ground its answers.

export interface RouteContext {
  label: string;
  kind:
    | "project"
    | "project_section"
    | "page"
    | "task"
    | "meeting"
    | "folder"
    | "division"
    | "escalation"
    | "my_tasks"
    | "inbox"
    | "notifications"
    | "resources_capacity"
    | "resources"
    
    | "executive"
    | "ops"
    | "crm"
    | "contacts"
    | "sales"
    | "agents"
    | "agent_runs"
    | "notes"
    | "chat"
    | "timesheet"
    | "settings"
    | "home"
    | "other";
  section?: string;
  ids: {
    projectId?: string;
    taskId?: string;
    pageId?: string;
    meetingId?: string;
    folderId?: string;
    divisionSlug?: string;
    escalationId?: string;
  };
}

export function resolveRouteContext(
  pathname: string,
  search: Record<string, unknown>,
): RouteContext {
  const ids: RouteContext["ids"] = {};
  if (typeof search?.task === "string") ids.taskId = search.task as string;
  if (typeof search?.p === "string") ids.pageId = search.p as string;

  // Project routes: /app/p/:projectId/<section>
  const projectMatch = pathname.match(/^\/app\/p\/([^/]+)(?:\/([^/?#]+))?/);
  if (projectMatch) {
    ids.projectId = projectMatch[1];
    const section = projectMatch[2];
    if (!section || section === "overview") {
      return { kind: "project", section: "overview", ids, label: "Project overview" };
    }
    return {
      kind: "project_section",
      section,
      ids,
      label: `Project · ${section.replace(/-/g, " ")}`,
    };
  }

  // Meeting detail
  const meetingMatch = pathname.match(/^\/app\/meetings\/([^/?#]+)/);
  if (meetingMatch) {
    ids.meetingId = meetingMatch[1];
    return { kind: "meeting", ids, label: "Meeting detail" };
  }

  // Escalation detail
  const escMatch = pathname.match(/^\/app\/escalations\/([^/?#]+)/);
  if (escMatch) {
    ids.escalationId = escMatch[1];
    return { kind: "escalation", ids, label: "Escalation detail" };
  }

  // Folder
  const folderMatch = pathname.match(/^\/app\/f\/([^/?#]+)/);
  if (folderMatch) {
    ids.folderId = folderMatch[1];
    return { kind: "folder", ids, label: "Folder" };
  }

  // Division
  const divMatch = pathname.match(/^\/app\/d\/([^/?#]+)/);
  if (divMatch) {
    ids.divisionSlug = divMatch[1];
    return { kind: "division", ids, label: `Division · ${divMatch[1]}` };
  }

  const map: Array<[RegExp, RouteContext["kind"], string]> = [
    [/^\/app\/pages/, "page", "Pages"],
    [/^\/app\/my-tasks/, "my_tasks", "My tasks"],
    [/^\/app\/inbox/, "inbox", "Inbox"],
    [/^\/app\/notifications/, "notifications", "Notifications"],
    [/^\/app\/resources\/capacity/, "resources_capacity", "Resource capacity"],
    [/^\/app\/resources/, "resources", "Resources"],
    
    [/^\/app\/executive/, "executive", "Executive"],
    [/^\/app\/ops/, "ops", "Operations"],
    [/^\/app\/crm/, "crm", "CRM"],
    [/^\/app\/contacts/, "contacts", "Contacts"],
    [/^\/app\/sales/, "sales", "Sales"],
    [/^\/app\/agents/, "agents", "Agents"],
    [/^\/app\/agent-runs/, "agent_runs", "Agent runs"],
    [/^\/app\/notes/, "notes", "Notes"],
    [/^\/app\/chat/, "chat", "Chat"],
    [/^\/app\/timesheet/, "timesheet", "Timesheet"],
    [/^\/app\/escalations/, "escalation", "Escalations"],
    [/^\/app\/meetings/, "meeting", "Meetings"],
    [/^\/app\/settings/, "settings", "Settings"],
    [/^\/app\/?$/, "home", "Home"],
  ];
  for (const [re, kind, label] of map) {
    if (re.test(pathname)) return { kind, ids, label };
  }
  return { kind: "other", ids, label: pathname };
}
