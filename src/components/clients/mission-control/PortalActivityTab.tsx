import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Share2,
  ExternalLink,
  CheckCircle2,
  MessageSquare,
  FileUp,
  ArrowRightCircle,
  CircleDot,
  LogIn,
  AlertCircle,
  Reply,
  Eye,
} from "lucide-react";
import {
  getPortalActivity,
  getClientTaskMatrix,
  markEventSeen,
  markAllAccountEventsSeen,
  respondToEvent,
} from "@/lib/portal-activity.functions";

type Project = { id: string; name: string; is_archived: boolean };

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  task_complete: CheckCircle2,
  task_comment: MessageSquare,
  doc_upload: FileUp,
  approval_given: ArrowRightCircle,
  status_update: CircleDot,
  login: LogIn,
};

const EVENT_COLOR: Record<string, string> = {
  task_complete: "text-emerald-500",
  task_comment: "text-blue-500",
  doc_upload: "text-purple-500",
  approval_given: "text-amber-500",
  status_update: "text-muted-foreground",
  login: "text-muted-foreground",
};

function formatEventTitle(
  type: string,
  contactName: string | null,
  projectName: string | null,
  payload: Record<string, unknown>,
): string {
  const who = contactName ?? "Client user";
  switch (type) {
    case "task_complete":
      return `${who} completed "${payload.task_title ?? "a task"}"`;
    case "task_comment":
      return `${who} commented on "${payload.task_title ?? "a task"}"`;
    case "doc_upload":
      return `${who} uploaded "${payload.file_name ?? "a file"}"`;
    case "status_update":
      return `${who} updated ${payload.field_name ?? "a field"}`;
    case "login":
      return `${who} logged in`;
    case "approval_given":
      return `${who} approved "${payload.phase_name ?? projectName ?? "a phase"}"`;
    default:
      return `${who} — ${type.replace(/_/g, " ")}`;
  }
}

function groupByDay<T extends { createdAt: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const d = new Date(it.createdAt);
    const today = new Date();
    const yest = new Date(Date.now() - 86_400_000);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = "Today";
    else if (d.toDateString() === yest.toDateString()) label = "Yesterday";
    else label = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(it);
  }
  return map;
}

export function PortalActivityTab({
  accountId,
  projects,
  currentUserId,
}: {
  accountId: string;
  projects: Project[];
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const activityFn = useServerFn(getPortalActivity);
  const matrixFn = useServerFn(getClientTaskMatrix);
  const markSeenFn = useServerFn(markEventSeen);
  const markAllFn = useServerFn(markAllAccountEventsSeen);
  const respondFn = useServerFn(respondToEvent);

  const { data: activity = [] } = useQuery({
    queryKey: ["portal-activity", accountId],
    queryFn: () => activityFn({ data: { accountId, limit: 100 } }),
    staleTime: 15_000,
  });

  const { data: matrix = [] } = useQuery({
    queryKey: ["portal-matrix", accountId],
    queryFn: () => matrixFn({ data: { accountId } }),
    staleTime: 30_000,
  });

  const markSeen = useMutation({
    mutationFn: (eventId: string) => markSeenFn({ data: { eventId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-activity", accountId] }),
  });

  const markAll = useMutation({
    mutationFn: () => markAllFn({ data: { accountId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-activity", accountId] });
      qc.invalidateQueries({ queryKey: ["unseen-counts"] });
      toast.success("Marked all as seen");
    },
  });

  const respond = useMutation({
    mutationFn: (eventId: string) => respondFn({ data: { eventId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-activity", accountId] });
      toast.success("Marked as responded");
    },
  });

  const unseenCount = activity.filter((a) => !a.seenByUserIds.includes(currentUserId)).length;
  const activeProjects = projects.filter((p) => !p.is_archived);
  const grouped = groupByDay(activity);

  return (
    <div className="space-y-4">
      {unseenCount > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-3 py-2 text-sm">
          <span>
            <strong>{unseenCount}</strong> new event{unseenCount === 1 ? "" : "s"} since your last visit
          </span>
          <Button size="sm" variant="ghost" onClick={() => markAll.mutate()}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Mark all seen
          </Button>
        </div>
      )}

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="matrix">
            Task matrix {matrix.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{matrix.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="access">Portal access</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4 mt-4">
          {activity.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground text-center">No portal activity yet.</Card>
          ) : (
            [...grouped.entries()].map(([day, events]) => (
              <div key={day} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-1">
                  {day}
                </h4>
                {events.map((e) => {
                  const Icon = EVENT_ICON[e.type] ?? CircleDot;
                  const color = EVENT_COLOR[e.type] ?? "text-muted-foreground";
                  const unseen = !e.seenByUserIds.includes(currentUserId);
                  const overdue =
                    e.requiresResponse &&
                    !e.respondedAt &&
                    Date.now() - new Date(e.createdAt).getTime() > 4 * 3_600_000;
                  return (
                    <Card
                      key={e.id}
                      className={`p-3 transition-colors ${
                        e.unblocksInternal ? "border-l-4 border-l-amber-500" : ""
                      } ${unseen ? "bg-primary/5" : ""}`}
                      onClick={() => unseen && markSeen.mutate(e.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm">{formatEventTitle(e.type, e.contactName, e.projectName, e.payload)}</span>
                            {overdue && (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertCircle className="h-3 w-3" /> No reply 4h+
                              </Badge>
                            )}
                            {e.unblocksInternal && (
                              <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                                Unblocks work
                              </Badge>
                            )}
                          </div>
                          {e.projectName && (
                            <p className="text-xs text-muted-foreground mt-0.5">Project: {e.projectName}</p>
                          )}
                          {(e.payload.comment_text || e.payload.completion_notes) && (
                            <p className="text-xs mt-1 italic text-muted-foreground line-clamp-2">
                              "{String(e.payload.comment_text ?? e.payload.completion_notes)}"
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            {e.requiresResponse && !e.respondedAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px]"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  respond.mutate(e.id);
                                }}
                              >
                                <Reply className="h-3 w-3 mr-1" /> Mark responded
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          {matrix.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground text-center">No open client-owed tasks.</Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Task</th>
                    <th className="text-left px-3 py-2 font-medium">Project</th>
                    <th className="text-left px-3 py-2 font-medium">Phase</th>
                    <th className="text-left px-3 py-2 font-medium">Due</th>
                    <th className="text-left px-3 py-2 font-medium">Last client action</th>
                    <th className="text-left px-3 py-2 font-medium">Blocks</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-3 py-2">{t.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t.projectName}</td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">{t.phase ?? "—"}</td>
                      <td className={`px-3 py-2 ${t.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {t.lastClientAction
                          ? `${t.lastClientAction.type.replace(/_/g, " ")} · ${new Date(t.lastClientAction.at).toLocaleDateString()}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{t.blocks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="access" className="mt-4">
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <Share2 className="h-4 w-4 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold">Portal access per project</h3>
                <p className="text-xs text-muted-foreground">
                  Each project has its own portal with permissions and shareable link.
                </p>
              </div>
            </div>
            {activeProjects.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No active projects to share.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activeProjects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-3">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link to="/app/p/$projectId/clients" params={{ projectId: p.id }}>
                        <Share2 className="h-3.5 w-3.5" /> Manage portal{" "}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
