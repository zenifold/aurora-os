import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useState } from "react";
import {
  useObjectTypes,
  useCreateObjectType,
  useDeleteObjectType,
  useUpdateObjectType,
} from "@/hooks/use-object-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Sliders, Lock } from "lucide-react";
import type { ObjectType } from "@/lib/object-types";

export const Route = createFileRoute("/app/settings/object-types")({
  component: () => (
    <RoleGuard min="manager">
      <ObjectTypesPage />
    </RoleGuard>
  ),
});

function ObjectTypesPage() {
  const { data: types = [], isLoading } = useObjectTypes();
  const create = useCreateObjectType();
  const update = useUpdateObjectType();
  const remove = useDeleteObjectType();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [plural, setPlural] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8b5cf6");

  const submit = async () => {
    if (!label.trim()) return;
    const key = label.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    await create.mutateAsync({
      key,
      label: label.trim(),
      plural_label: plural.trim() || `${label.trim()}s`,
      description: description.trim() || null,
      color,
    });
    setLabel("");
    setPlural("");
    setDescription("");
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Object types</h2>
          <p className="text-sm text-muted-foreground">
            Define the kinds of things your workspace tracks. Built-in types are seeded for you;
            add custom types like <em>Bug</em>, <em>Discovery Call</em>, or <em>Asset</em>.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> New object type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New object type</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Singular name</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bug" />
              </div>
              <div className="space-y-1.5">
                <Label>Plural name</Label>
                <Input
                  value={plural}
                  onChange={(e) => setPlural(e.target.value)}
                  placeholder="Bugs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this object used for?"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Accent color</Label>
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-20 p-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={create.isPending || !label.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {types.map((t) => (
              <ObjectTypeRow
                key={t.id}
                type={t}
                onArchiveToggle={() =>
                  update.mutate({ id: t.id, is_archived: !t.is_archived })
                }
                onDelete={() => {
                  if (t.is_system) return;
                  if (confirm(`Delete "${t.label}"? This removes all fields and records of this type.`)) {
                    remove.mutate(t.id);
                  }
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ObjectTypeRow({
  type,
  onDelete,
  onArchiveToggle,
}: {
  type: ObjectType;
  onDelete: () => void;
  onArchiveToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
          style={{ backgroundColor: type.color ?? "#8b5cf6" }}
        >
          {type.label.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{type.label}</div>
            {type.is_system && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> Built-in
              </Badge>
            )}
            {type.is_archived && <Badge variant="outline">Archived</Badge>}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            <code className="text-[10px] mr-2">{type.key}</code>
            {type.description ?? "—"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button asChild size="sm" variant="ghost">
          <Link to="/app/settings/fields" search={{ object_type: type.id }}>
            <Sliders className="mr-1.5 h-4 w-4" /> Fields
          </Link>
        </Button>
        {!type.is_system && (
          <>
            <Button size="sm" variant="ghost" onClick={onArchiveToggle}>
              {type.is_archived ? "Restore" : "Archive"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
