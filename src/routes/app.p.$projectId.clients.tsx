import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useProject } from "@/hooks/use-projects";
import {
  useClientAccess,
  useInviteClient,
  useRevokeClientAccess,
  useRotatePortalToken,
  useUpdateClientAccess,
  useDeliverables,
  usePortalActivity,
  buildPortalUrl,
} from "@/hooks/use-client-portal";
import { DELIVERABLE_TYPE_LABELS, REVIEW_STATUS_LABELS } from "@/lib/client-portal-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Copy, Trash2, Users, RefreshCw, Activity } from "lucide-react";
import type { ClientRole } from "@/lib/client-portal-types";
import { ROLE_LABELS } from "@/lib/client-portal-types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/p/$projectId/clients")({
  component: ClientsPage,
});

const ACTIVITY_LABELS: Record<string, string> = {
  login: "logged in",
  viewed_task: "viewed a task",
  completed_deliverable: "submitted a deliverable",
  commented: "commented",
  downloaded_file: "downloaded a file",
  viewed_timeline: "viewed timeline",
  acknowledged_impact: "acknowledged impact",
};

function ClientsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: clients = [] } = useClientAccess(projectId);
  const { data: deliverables = [] } = useDeliverables(projectId);
  const { data: activity = [] } = usePortalActivity(projectId);
  const invite = useInviteClient();
  const revoke = useRevokeClientAccess();
  const rotate = useRotatePortalToken();
  const update = useUpdateClientAccess();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    company: "",
    role: "contributor" as ClientRole,
    can_see_financials: false,
    can_see_team_names: true,
    can_see_timeline: true,
    can_see_invoices: false,
    can_see_documents: false,
    expires_in_days: "0",
  });

  const reset = () =>
    setForm({
      email: "",
      name: "",
      company: "",
      role: "contributor",
      can_see_financials: false,
      can_see_team_names: true,
      can_see_timeline: true,
      can_see_invoices: false,
      can_see_documents: false,
      expires_in_days: "0",
    });


  const submit = async () => {
    if (!form.email.trim() || !form.name.trim()) return;
    const { expires_in_days, ...rest } = form;
    const created = await invite.mutateAsync({ project_id: projectId, ...rest });
    const days = parseInt(expires_in_days, 10);
    if (created && days > 0) {
      const expires = new Date();
      expires.setDate(expires.getDate() + days);
      await update.mutateAsync({ id: created.id, token_expires_at: expires.toISOString() });
    }
    setOpen(false);
    reset();
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(buildPortalUrl(token));
    toast.success("Portal link copied");
  };

  const rotateAndCopy = async (id: string) => {
    const token = await rotate.mutateAsync(id);
    if (token) {
      await navigator.clipboard.writeText(buildPortalUrl(token));
      toast.success("New link copied to clipboard");
    }
  };

  const setExpiry = async (id: string, days: number) => {
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    await update.mutateAsync({ id, token_expires_at: expires.toISOString() });
    toast.success(`Link expires in ${days} day${days === 1 ? "" : "s"}`);
  };

  const clearExpiry = async (id: string) => {
    await update.mutateAsync({ id, token_expires_at: null });
    toast.success("Expiry cleared");
  };

  const clientNameById = new Map(clients.map((c) => [c.id, c.name] as const));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/p/$projectId" params={{ projectId }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{project?.name ?? "Project"}</h1>
          <p className="text-xs text-muted-foreground">Client portal access</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Invite client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite client to portal</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Company (optional)</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as ClientRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as ClientRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Link expires</Label>
                <Select
                  value={form.expires_in_days}
                  onValueChange={(v) => setForm({ ...form, expires_in_days: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Never</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium">What they can see</p>
                {[
                  { k: "can_see_team_names" as const, label: "Team member names" },
                  { k: "can_see_timeline" as const, label: "Timeline / Gantt" },
                  { k: "can_see_financials" as const, label: "Financial summary" },
                  { k: "can_see_invoices" as const, label: "Invoices" },
                  { k: "can_see_documents" as const, label: "Documents & contracts" },
                ].map((o) => (

                  <div key={o.k} className="flex items-center justify-between text-sm">
                    <span>{o.label}</span>
                    <Switch
                      checked={form[o.k]}
                      onCheckedChange={(v) => setForm({ ...form, [o.k]: v })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!form.email.trim() || !form.name.trim() || invite.isPending}>
                Send invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-auto p-6 lg:grid-cols-[1fr,320px]">
        <div>
          {clients.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm">No clients invited yet</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Client</th>
                    <th className="px-3 py-2 text-left">Role</th>
                    <th className="px-3 py-2 text-left">Link</th>
                    <th className="px-3 py-2 text-left">Last login</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const clientDeliverables = deliverables.filter(
                      (d) => d.client_portal_access_id === c.id,
                    );
                    const isExpired =
                      !!c.token_expires_at && new Date(c.token_expires_at).getTime() < Date.now();
                    return (
                      <tr key={c.id} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          <div>
                            <p className="font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.email}{c.company ? ` · ${c.company}` : ""}
                            </p>
                            {clientDeliverables.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {clientDeliverables.map((d) => (
                                  <li key={d.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {DELIVERABLE_TYPE_LABELS[d.deliverable_type]}
                                    </Badge>
                                    <span>{d.client_deadline ?? "no deadline"}</span>
                                    <Badge variant="outline" className="text-[10px]">
                                      {REVIEW_STATUS_LABELS[d.review_status]}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="capitalize">{c.role}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {isExpired ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : c.token_expires_at ? (
                            <span className="text-muted-foreground">
                              expires {new Date(c.token_expires_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">no expiry</span>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {[7, 30, 90].map((d) => (
                              <Button
                                key={d}
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px]"
                                onClick={() => setExpiry(c.id, d)}
                              >
                                {d}d
                              </Button>
                            ))}
                            {c.token_expires_at && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px]"
                                onClick={() => clearExpiry(c.id)}
                              >
                                clear
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {c.last_login_at ? new Date(c.last_login_at).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="icon" onClick={() => copyLink(c.access_token)} aria-label="Copy portal link" title="Copy link">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => rotateAndCopy(c.id)} aria-label="Rotate token" title="Rotate link (invalidates old)">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => revoke.mutate(c.id)} aria-label="Revoke" title="Revoke access">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Card className="h-fit p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4" /> Recent activity
          </h2>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No client activity yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {activity.slice(0, 25).map((a) => {
                const meta = a.metadata as { deliverable_id?: string; path?: string; uploaded?: string };
                const name = a.client_portal_access_id
                  ? clientNameById.get(a.client_portal_access_id) ?? "A client"
                  : "Someone";
                return (
                  <li key={a.id} className="flex items-start gap-2 border-b border-border pb-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p>
                        <span className="font-medium">{name}</span>{" "}
                        <span className="text-muted-foreground">
                          {ACTIVITY_LABELS[a.activity_type] ?? a.activity_type}
                        </span>
                      </p>
                      {meta.uploaded && (
                        <p className="truncate text-[10px] text-muted-foreground">{meta.uploaded}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
