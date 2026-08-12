import { useState } from "react";
import { Palette, Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBrandKits, useUpsertBrandKit, useDeleteBrandKit } from "@/hooks/use-documents";
import type { BrandKit } from "@/lib/document-types";

interface BrandKitManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** When set, manages per-client brand kits; otherwise workspace defaults. */
  clientAccountId?: string | null;
}

const BLANK: Omit<BrandKit, "id" | "workspace_id" | "client_account_id" | "created_at" | "updated_at" | "created_by"> = {
  name: "New brand kit",
  logo_url: null,
  cover_url: null,
  primary_color: "#0F172A",
  accent_color: "#3B82F6",
  text_color: "#0F172A",
  font_heading: "Inter",
  font_body: "Inter",
  footer_text: null,
  is_default: false,
};

export function BrandKitManagerDialog({
  open,
  onOpenChange,
  workspaceId,
  clientAccountId,
}: BrandKitManagerDialogProps) {
  const { data: kits = [] } = useBrandKits(workspaceId, clientAccountId);
  const upsert = useUpsertBrandKit(workspaceId);
  const remove = useDeleteBrandKit(workspaceId);

  const [editing, setEditing] = useState<Partial<BrandKit> | null>(null);

  const startNew = () =>
    setEditing({
      ...BLANK,
      workspace_id: workspaceId,
      client_account_id: clientAccountId ?? null,
    });

  const handleSave = async () => {
    if (!editing?.name) return;
    await upsert.mutateAsync({
      id: editing.id ?? null,
      workspace_id: workspaceId,
      client_account_id: clientAccountId ?? null,
      name: editing.name,
      logo_url: editing.logo_url ?? null,
      cover_url: editing.cover_url ?? null,
      primary_color: editing.primary_color || "#0F172A",
      accent_color: editing.accent_color || "#3B82F6",
      text_color: editing.text_color || "#0F172A",
      font_heading: editing.font_heading || "Inter",
      font_body: editing.font_body || "Inter",
      footer_text: editing.footer_text ?? null,
      is_default: editing.is_default ?? false,
    });
    setEditing(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {clientAccountId ? "Client brand kits" : "Workspace brand kits"}
          </DialogTitle>
          <DialogDescription>
            {clientAccountId
              ? "Per-client branding overrides for white-label documents."
              : "Default branding applied to documents across the workspace."}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Name</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Primary color</Label>
                <Input
                  type="color"
                  value={editing.primary_color ?? "#0F172A"}
                  onChange={(e) => setEditing({ ...editing, primary_color: e.target.value })}
                  className="h-9 w-full"
                />
              </div>
              <div className="space-y-1">
                <Label>Accent color</Label>
                <Input
                  type="color"
                  value={editing.accent_color ?? "#3B82F6"}
                  onChange={(e) => setEditing({ ...editing, accent_color: e.target.value })}
                  className="h-9 w-full"
                />
              </div>
              <div className="space-y-1">
                <Label>Text color</Label>
                <Input
                  type="color"
                  value={editing.text_color ?? "#0F172A"}
                  onChange={(e) => setEditing({ ...editing, text_color: e.target.value })}
                  className="h-9 w-full"
                />
              </div>
              <div className="space-y-1">
                <Label>Heading font</Label>
                <Input
                  value={editing.font_heading ?? ""}
                  onChange={(e) => setEditing({ ...editing, font_heading: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Body font</Label>
                <Input
                  value={editing.font_body ?? ""}
                  onChange={(e) => setEditing({ ...editing, font_body: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Logo URL</Label>
                <Input
                  placeholder="https://…"
                  value={editing.logo_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, logo_url: e.target.value || null })}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Footer text</Label>
                <Textarea
                  rows={2}
                  value={editing.footer_text ?? ""}
                  onChange={(e) => setEditing({ ...editing, footer_text: e.target.value || null })}
                />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editing.is_default}
                  onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })}
                />
                Use as default
              </label>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={upsert.isPending}>
                {upsert.isPending ? "Saving…" : "Save brand kit"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {kits.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No brand kits yet. Create one to brand your documents.
              </div>
            ) : (
              <ul className="space-y-2">
                {kits.map((k) => (
                  <li key={k.id}>
                    <Card className="flex items-center gap-3 p-3">
                      <div className="flex gap-1">
                        <span
                          className="h-7 w-7 rounded border border-border"
                          style={{ background: k.primary_color }}
                        />
                        <span
                          className="h-7 w-7 rounded border border-border"
                          style={{ background: k.accent_color }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{k.name}</span>
                          {k.is_default && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Star className="h-3 w-3" /> Default
                            </Badge>
                          )}
                          {k.client_account_id && (
                            <Badge variant="outline" className="text-[10px]">Client</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {k.font_heading} · {k.font_body}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(k)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (window.confirm(`Delete "${k.name}"?`)) remove.mutate(k.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button onClick={startNew}>
                <Plus className="h-4 w-4 mr-1" /> New brand kit
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
