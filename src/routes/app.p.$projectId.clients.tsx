import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useProject } from "@/hooks/use-projects";
import {
  useClientAccess,
  useInviteClient,
  useRevokeClientAccess,
  buildPortalUrl,
} from "@/hooks/use-client-portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { ArrowLeft, Plus, Copy, Trash2, Users } from "lucide-react";
import type { ClientRole } from "@/lib/client-portal-types";
import { ROLE_LABELS } from "@/lib/client-portal-types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/p/$projectId/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: clients = [] } = useClientAccess(projectId);
  const invite = useInviteClient();
  const revoke = useRevokeClientAccess();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    company: "",
    role: "contributor" as ClientRole,
    can_see_financials: false,
    can_see_team_names: true,
    can_see_timeline: true,
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
    });

  const submit = async () => {
    if (!form.email.trim() || !form.name.trim()) return;
    await invite.mutateAsync({ project_id: projectId, ...form });
    setOpen(false);
    reset();
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(buildPortalUrl(token));
    toast.success("Portal link copied");
  };

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
              <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium">What they can see</p>
                {[
                  { k: "can_see_team_names" as const, label: "Team member names" },
                  { k: "can_see_timeline" as const, label: "Timeline / Gantt" },
                  { k: "can_see_financials" as const, label: "Financial summary" },
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

      <div className="min-h-0 flex-1 overflow-auto p-6">
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
                  <th className="px-3 py-2 text-left">Last login</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.email}{c.company ? ` · ${c.company}` : ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="capitalize">{c.role}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.last_login_at ? new Date(c.last_login_at).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => copyLink(c.access_token)} aria-label="Copy portal link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => revoke.mutate(c.id)} aria-label="Revoke">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
