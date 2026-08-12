import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Shield, Trash2, Lock, Copy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_META,
  type Permission,
  type WorkspaceRoleSlug,
} from "@/lib/permissions";

export const Route = createFileRoute("/app/settings/roles")({
  component: () => (
    <RoleGuard min="manager">
      <RolesPage />
    </RoleGuard>
  ),
});

interface RoleDefinition {
  id: string;
  workspace_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  is_guest_role: boolean;
}

function RolesPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canManage = perms.can(PERMISSIONS.WORKSPACE_MANAGE_ROLES);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [cloneFromId, setCloneFromId] = useState<string | null>(null);

  // Roles available in this workspace (system roles where workspace_id is null + custom for this ws)
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["role-definitions", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_definitions")
        .select("id, workspace_id, name, slug, description, is_system, is_guest_role")
        .or(`workspace_id.is.null,workspace_id.eq.${ws!.id}`)
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as RoleDefinition[];
    },
  });

  const { data: permsByRole = {} } = useQuery({
    queryKey: ["role-permissions", roles.map((r) => r.id).join(",")],
    enabled: roles.length > 0,
    queryFn: async () => {
      const ids = roles.map((r) => r.id);
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role_id, permission")
        .in("role_id", ids);
      if (error) throw error;
      const map: Record<string, Set<string>> = {};
      for (const row of data ?? []) {
        const r = (row as { role_id: string; permission: string }).role_id;
        if (!map[r]) map[r] = new Set();
        map[r].add((row as { permission: string }).permission);
      }
      return map;
    },
  });

  // Default selection
  const selected = useMemo(() => {
    if (selectedId) return roles.find((r) => r.id === selectedId) ?? null;
    return roles[0] ?? null;
  }, [roles, selectedId]);

  const selectedPerms = (selected && permsByRole[selected.id]) || new Set<string>();
  const isOwnerRole = selected?.slug === "owner";
  const editable = canManage && !!selected && !selected.is_system && !isOwnerRole;

  const togglePermission = useMutation({
    mutationFn: async ({ permission, on }: { permission: Permission; on: boolean }) => {
      if (!selected) return;
      if (on) {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role_id: selected.id, permission });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", selected.id)
          .eq("permission", permission);
        if (error) throw error;
      }
      await supabase.rpc("log_audit_event", {
        _workspace_id: ws!.id,
        _action: on ? "role.permission_granted" : "role.permission_revoked",
        _target_type: "role",
        _target_id: selected.id,
        _target_label: selected.name,
        _metadata: { permission },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["permissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRole = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Name is required");
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data, error } = await supabase
        .from("role_definitions")
        .insert({
          workspace_id: ws!.id,
          name,
          slug,
          description: newDesc.trim() || null,
          is_system: false,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      const newId = (data as { id: string }).id;
      // Clone perms if requested
      if (cloneFromId) {
        const sourcePerms = Array.from(permsByRole[cloneFromId] ?? []);
        if (sourcePerms.length > 0) {
          await supabase
            .from("role_permissions")
            .insert(sourcePerms.map((p) => ({ role_id: newId, permission: p })));
        }
      }
      await supabase.rpc("log_audit_event", {
        _workspace_id: ws!.id,
        _action: "role.created",
        _target_type: "role",
        _target_id: newId,
        _target_label: name,
        _metadata: { cloned_from: cloneFromId },
      });
      return newId;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["role-definitions"] });
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      setSelectedId(newId);
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      setCloneFromId(null);
      toast.success("Role created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRole = useMutation({
    mutationFn: async (role: RoleDefinition) => {
      // Check no members are still assigned
      const { count, error: cErr } = await supabase
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws!.id)
        .eq("role_definition_id", role.id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(`Reassign ${count} member${count === 1 ? "" : "s"} before deleting this role`);
      }
      const { error } = await supabase.from("role_definitions").delete().eq("id", role.id);
      if (error) throw error;
      await supabase.rpc("log_audit_event", {
        _workspace_id: ws!.id,
        _action: "role.deleted",
        _target_type: "role",
        _target_id: role.id,
        _target_label: role.name,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-definitions"] });
      setSelectedId(null);
      toast.success("Role deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const systemRoles = roles.filter((r) => r.is_system);
  const customRoles = roles.filter((r) => !r.is_system);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Roles & permissions</h1>
          <p className="text-sm text-muted-foreground">
            Define what each role can do across projects, finance, CRM, and sharing.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            <Plus className="mr-2 h-4 w-4" />
            New role
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          <RoleListSection
            label="System roles"
            roles={systemRoles}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            permsByRole={permsByRole}
          />
          <RoleListSection
            label="Custom roles"
            roles={customRoles}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            permsByRole={permsByRole}
            empty="No custom roles yet."
          />
        </div>

        {/* Detail */}
        <div className="rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !selected ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Select a role to view permissions.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    {selected.is_system ? (
                      <Badge variant="secondary"><Lock className="mr-1 h-3 w-3" />System</Badge>
                    ) : (
                      <Badge variant="outline">Custom</Badge>
                    )}
                    {selected.is_guest_role && <Badge variant="outline">Guest</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.description ?? ROLE_META[selected.slug as WorkspaceRoleSlug]?.description ?? "Custom workspace role."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCloneFromId(selected.id);
                        setNewName(`${selected.name} copy`);
                        setNewDesc(selected.description ?? "");
                        setCreateOpen(true);
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </Button>
                  )}
                  {editable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete role "${selected.name}"?`)) deleteRole.mutate(selected);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {!editable && !isOwnerRole && (
                <div className="border-b border-border bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
                  <Lock className="mr-1 inline h-3 w-3" />
                  System roles cannot be edited. Duplicate to create a custom variant.
                </div>
              )}
              {isOwnerRole && (
                <div className="border-b border-border bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
                  <Shield className="mr-1 inline h-3 w-3" />
                  Owner has every permission and cannot be modified.
                </div>
              )}

              <div className="divide-y divide-border">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label} className="p-5">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold">{group.label}</h3>
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                    </div>
                    <ul className="space-y-2">
                      {group.permissions.map((p) => {
                        const checked = isOwnerRole || selectedPerms.has(p.key);
                        return (
                          <li key={p.key} className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/30">
                            <Checkbox
                              checked={checked}
                              disabled={!editable || togglePermission.isPending}
                              onCheckedChange={(v) =>
                                togglePermission.mutate({ permission: p.key, on: v === true })
                              }
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium">{p.label}</div>
                              <div className="text-xs text-muted-foreground">{p.description}</div>
                            </div>
                            <code className="text-[10px] text-muted-foreground">{p.key}</code>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create / clone dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cloneFromId ? "Duplicate role" : "New custom role"}</DialogTitle>
            <DialogDescription>
              {cloneFromId
                ? "Create a copy with the same permissions you can then customize."
                : "Custom roles let you tailor exactly what teammates can do."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createRole.mutate();
            }}
          >
            <div>
              <label className="mb-1 block text-xs font-medium">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Finance Lead"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Description</label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What this role can do"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreateOpen(false);
                  setCloneFromId(null);
                  setNewName("");
                  setNewDesc("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRole.isPending || !newName.trim()}
                className="bg-aura-gradient text-primary-foreground hover:opacity-90"
              >
                {createRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleListSection({
  label,
  roles,
  selectedId,
  onSelect,
  permsByRole,
  empty,
}: {
  label: string;
  roles: RoleDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  permsByRole: Record<string, Set<string>>;
  empty?: string;
}) {
  return (
    <div>
      <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {roles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          {empty ?? "Nothing yet."}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {roles.map((r) => {
            const active = r.id === selectedId;
            const meta = ROLE_META[r.slug as WorkspaceRoleSlug];
            const count = (permsByRole[r.id] ?? new Set()).size;
            return (
              <li key={r.id}>
                <button
                  onClick={() => onSelect(r.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    active ? "bg-aura-gradient-subtle font-medium" : "hover:bg-accent"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: meta?.accent ?? "#64748b" }}
                  />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.slug === "owner" ? "all" : count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
