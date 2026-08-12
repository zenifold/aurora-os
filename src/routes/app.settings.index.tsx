import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useState, useEffect } from "react";
import { useWorkspaceStore, type WorkspaceKind } from "@/stores/workspace-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, X, Plus } from "lucide-react";

import { BrandingSettingsCard } from "@/components/app/BrandingSettingsCard";
import { isPersonalEmailDomain } from "@/lib/personal-email-domains";

export const Route = createFileRoute("/app/settings/")({
  component: () => (
    <RoleGuard min="manager">
      <WorkspaceSettings />
    </RoleGuard>
  ),
});

interface WorkspaceFull {
  id: string;
  name: string;
  slug: string;
  plan: string;
  kind: WorkspaceKind;
  linked_delivery_workspace_id: string | null;
  logo_url: string | null;
  auto_join_domains: string[];
  settings: { description?: string; color?: string; organization_name?: string } | null;
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

function WorkspaceSettings() {
  const ws = useWorkspaceStore((s) => s.current);
  const allWorkspaces = useWorkspaceStore((s) => s.workspaces);
  const fetchWs = useWorkspaceStore((s) => s.fetch);
  const qc = useQueryClient();

  const { data: full, isLoading } = useQuery({
    queryKey: ["workspace-full", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, slug, plan, kind, linked_delivery_workspace_id, logo_url, auto_join_domains, settings")
        .eq("id", ws!.id)
        .single();
      if (error) throw error;
      return data as WorkspaceFull;
    },
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [kind, setKind] = useState<WorkspaceKind>("hybrid");
  const [linkedDelivery, setLinkedDelivery] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!full) return;
    setName(full.name);
    setSlug(full.slug);
    setDescription(full.settings?.description ?? "");
    setColor(full.settings?.color ?? COLORS[0]);
    setKind(full.kind ?? "hybrid");
    setLinkedDelivery(full.linked_delivery_workspace_id ?? "");
    setLogoUrl(full.logo_url);
    setDomains(full.auto_join_domains ?? []);
  }, [full]);

  const deliveryOptions = allWorkspaces.filter(
    (w) => w.id !== ws?.id && (w.kind === "delivery" || w.kind === "hybrid"),
  );

  const uploadLogo = async (file: File) => {
    if (!ws) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${ws.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("workspace-logos").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("workspace-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      const { error } = await supabase.from("workspaces").update({ logo_url: data.publicUrl }).eq("id", ws.id);
      if (error) throw error;
      toast.success("Logo uploaded");
      qc.invalidateQueries({ queryKey: ["workspace-full", ws.id] });
      fetchWs();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!ws) return;
    setLogoUrl(null);
    await supabase.from("workspaces").update({ logo_url: null }).eq("id", ws.id);
    qc.invalidateQueries({ queryKey: ["workspace-full", ws.id] });
    fetchWs();
  };

  const addDomain = () => {
    const d = domainInput.trim().toLowerCase().replace(/^@/, "");
    if (!d || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) {
      toast.error("Enter a valid domain (e.g. acme.com)");
      return;
    }
    if (isPersonalEmailDomain(d)) {
      toast.error(`${d} is a personal email provider — only company-owned domains can auto-join.`);
      return;
    }
    if (domains.includes(d)) return;
    setDomains([...domains, d]);
    setDomainInput("");
  };
  const removeDomain = (d: string) => setDomains(domains.filter((x) => x !== d));

  const save = async () => {
    if (!ws) return;
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({
        name: name.trim(),
        slug: slug.trim() || ws.slug,
        kind,
        linked_delivery_workspace_id: linkedDelivery || null,
        auto_join_domains: domains,
        settings: { ...(full?.settings ?? {}), description, color },
      })
      .eq("id", ws.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Workspace updated");
    qc.invalidateQueries({ queryKey: ["workspace-full", ws.id] });
    fetchWs();
  };

  if (isLoading || !full) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Workspace</h1>
        <p className="text-sm text-muted-foreground">General workspace settings.</p>
      </div>

      <section className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Workspace logo"
              className="h-14 w-14 rounded-xl border border-border object-cover"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)` }}
            >
              {(name || "A").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name || "Workspace"}</p>
            <p className="truncate text-xs text-muted-foreground">/{slug}</p>
            <div className="mt-1.5 flex gap-1.5">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo(f);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {logoUrl ? "Replace logo" : "Upload logo"}
                </span>
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="name">Workspace name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>

        <div>
          <Label htmlFor="slug">URL slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            className="mt-1.5 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens.</p>
        </div>

        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this workspace for?"
            className="mt-1.5"
            rows={3}
          />
        </div>

        <div>
          <Label>Accent color</Label>
          <div className="mt-2 flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={save}
            disabled={saving || !name.trim()}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </section>

      <section className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-6">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Workspace type</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Defines what this workspace is used for. Sales workspaces show the CRM. Delivery workspaces hold projects. Hybrid shows both.
          </p>
        </div>

        <div>
          <Label>Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as WorkspaceKind)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hybrid">Hybrid — sales + delivery</SelectItem>
              <SelectItem value="sales">Sales — CRM pipeline only</SelectItem>
              <SelectItem value="delivery">Delivery — projects only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(kind === "sales" || kind === "hybrid") && (
          <div>
            <Label>Linked delivery workspace</Label>
            <Select value={linkedDelivery || "none"} onValueChange={(v) => setLinkedDelivery(v === "none" ? "" : v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {deliveryOptions.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              When deals are won, projects are auto-created in this workspace.
            </p>
          </div>
        )}
      </section>

      <section className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Auto-join domains</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            New users signing up with these email domains can join this workspace automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDomain();
              }
            }}
            placeholder="acme.com"
            className="font-mono text-sm"
          />
          <Button type="button" variant="outline" onClick={addDomain}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {domains.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {domains.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-mono"
              >
                {d}
                <button
                  type="button"
                  onClick={() => removeDomain(d)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${d}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Generic providers (gmail, outlook, etc.) are ignored even if added. Click "Save changes" above to apply.
        </p>
      </section>

      <BrandingSettingsCard />

      

      <section className="max-w-xl rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Plan</h3>
        <p className="mt-3 text-sm">
          You're on the <span className="font-medium capitalize">{full.plan}</span> plan.
        </p>
      </section>
    </div>
  );
}
