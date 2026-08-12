import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Share2, Plus, Copy, Trash2, Lock, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

export const Route = createFileRoute("/app/settings/sharing")({
  component: () => (
    <RoleGuard min="manager">
      <SharingPage />
    </RoleGuard>
  ),
});

const RESOURCE_TYPES = [
  { value: "project", label: "Project" },
  { value: "view", label: "View" },
  { value: "page", label: "Page" },
  { value: "note", label: "Note" },
  
  { value: "dashboard", label: "Dashboard" },
] as const;

interface ShareLink {
  id: string;
  workspace_id: string;
  resource_type: string;
  resource_id: string;
  label: string | null;
  token: string;
  password_hash: string | null;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  last_viewed_at: string | null;
  allow_comments: boolean;
  permissions: Record<string, unknown>;
  created_by: string;
  revoked_at: string | null;
  created_at: string;
}

function SharingPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.SHARING_MANAGE);

  const [statusFilter, setStatusFilter] = useState<"active" | "revoked" | "all">("active");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: links = [], isFetching } = useQuery({
    queryKey: ["share-links", ws?.id, statusFilter],
    enabled: !!ws,
    queryFn: async () => {
      let q = supabase
        .from("shared_links")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("created_at", { ascending: false });
      if (statusFilter === "active") q = q.is("revoked_at", null);
      if (statusFilter === "revoked") q = q.not("revoked_at", "is", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ShareLink[];
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shared_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await supabase.rpc("log_audit_event", {
        _workspace_id: ws!.id,
        _action: "share_link.revoked",
        _target_type: "shared_link",
        _target_id: id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share-links"] });
      toast.success("Link revoked");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shared_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share-links"] });
      toast.success("Link deleted");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const counts = useMemo(() => {
    const active = links.filter((l) => !l.revoked_at && (!l.expires_at || new Date(l.expires_at) > new Date())).length;
    const expired = links.filter((l) => l.expires_at && new Date(l.expires_at) <= new Date() && !l.revoked_at).length;
    return { active, expired, total: links.length };
  }, [links]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Share2 className="h-4 w-4" /> External sharing
          </h2>
          <p className="text-sm text-muted-foreground">
            Public links that let people outside the workspace view a single resource.
          </p>
        </div>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New share link
              </Button>
            </DialogTrigger>
            <CreateLinkDialog onClose={() => setCreateOpen(false)} />
          </Dialog>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCard label="Active links" value={counts.active} />
        <StatCard label="Expired" value={counts.expired} />
        <StatCard label="Total ever created" value={counts.total} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Resource</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Views</th>
              <th className="px-3 py-2 text-left">Expires</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.length === 0 && !isFetching && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  No share links yet. Create one to give external collaborators access.
                </td>
              </tr>
            )}
            {links.map((l) => {
              const expired = l.expires_at && new Date(l.expires_at) <= new Date();
              const isRevoked = !!l.revoked_at;
              return (
                <tr key={l.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.label ?? "(untitled)"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {l.resource_type} · {l.resource_id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {isRevoked ? (
                      <Badge variant="destructive" className="text-[10px]">Revoked</Badge>
                    ) : expired ? (
                      <Badge variant="secondary" className="text-[10px]">Expired</Badge>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="default" className="text-[10px]">Active</Badge>
                        {l.password_hash && (
                          <Badge variant="outline" className="text-[10px]">
                            <Lock className="mr-0.5 h-2.5 w-2.5" /> Password
                          </Badge>
                        )}
                        {l.allow_comments && (
                          <Badge variant="outline" className="text-[10px]">Comments</Badge>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {l.view_count}
                    {l.max_views != null && <span className="text-muted-foreground"> / {l.max_views}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {l.expires_at ? formatDistanceToNow(new Date(l.expires_at), { addSuffix: true }) : "Never"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyLink(l.token)}
                        title="Copy link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/share/${l.token}`, "_blank")}
                        title="Open"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      {canManage && !isRevoked && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revoke.mutate(l.id)}
                          title="Revoke"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Permanently delete this link?")) remove.mutate(l.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function CreateLinkDialog({ onClose }: { onClose: () => void }) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  const [resourceType, setResourceType] = useState<string>("project");
  const [resourceId, setResourceId] = useState("");
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>("30");
  const [maxViews, setMaxViews] = useState("");
  const [allowComments, setAllowComments] = useState(false);

  // Pre-populate resource pickers for common types
  const { data: projects = [] } = useQuery({
    queryKey: ["share-pick-projects", ws?.id],
    enabled: !!ws && resourceType === "project",
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("workspace_id", ws!.id)
        .order("name");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!resourceId) throw new Error("Pick a resource to share");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      let password_hash: string | null = null;
      if (usePassword && password) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
        password_hash = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }

      const expires_at =
        expiresInDays === "never"
          ? null
          : new Date(Date.now() + Number(expiresInDays) * 86400_000).toISOString();

      const { data, error } = await supabase
        .from("shared_links")
        .insert({
          workspace_id: ws!.id,
          resource_type: resourceType,
          resource_id: resourceId,
          label: label || null,
          password_hash,
          expires_at,
          max_views: maxViews ? Number(maxViews) : null,
          allow_comments: allowComments,
          created_by: uid,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.rpc("log_audit_event", {
        _workspace_id: ws!.id,
        _action: "share_link.created",
        _target_type: "shared_link",
        _target_id: data.id,
        _target_label: label || resourceType,
        _metadata: { resource_type: resourceType, resource_id: resourceId },
      });
      return data;
    },
    onSuccess: (link) => {
      qc.invalidateQueries({ queryKey: ["share-links"] });
      const url = `${window.location.origin}/share/${link.token}`;
      navigator.clipboard.writeText(url);
      toast.success("Link created and copied to clipboard");
      onClose();
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create share link</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Resource type</Label>
            <Select value={resourceType} onValueChange={(v) => { setResourceType(v); setResourceId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Resource</Label>
            {resourceType === "project" ? (
              <Select value={resourceId} onValueChange={setResourceId}>
                <SelectTrigger><SelectValue placeholder="Pick a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                placeholder="UUID"
              />
            )}
          </div>
        </div>

        <div>
          <Label className="text-xs">Label (visible to recipients)</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Q4 sprint plan" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Expires</Label>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Max views (optional)</Label>
            <Input
              type="number"
              min={1}
              value={maxViews}
              onChange={(e) => setMaxViews(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-2">
          <div>
            <Label className="text-sm">Require password</Label>
            <p className="text-[11px] text-muted-foreground">Recipients enter the password to open</p>
          </div>
          <Switch checked={usePassword} onCheckedChange={setUsePassword} />
        </div>
        {usePassword && (
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        )}

        <div className="flex items-center justify-between rounded-md border border-border p-2">
          <div>
            <Label className="text-sm">Allow comments</Label>
            <p className="text-[11px] text-muted-foreground">Guests can leave feedback</p>
          </div>
          <Switch checked={allowComments} onCheckedChange={setAllowComments} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create link"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
