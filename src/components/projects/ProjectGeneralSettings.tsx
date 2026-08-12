import { useEffect, useState } from "react";
import { confirmDialog } from "@/lib/dialogs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { useNavigate } from "@tanstack/react-router";
import type { Project } from "@/lib/types";
import { Trash2 } from "lucide-react";

export function ProjectGeneralSettings({ project }: { project: Project }) {
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const navigate = useNavigate();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [color, setColor] = useState(project.color ?? "#8b5cf6");
  const [client, setClient] = useState(project.client_name ?? "");
  const [isClient, setIsClient] = useState(!!project.is_client_project);
  const [start, setStart] = useState(project.start_date ?? "");
  const [end, setEnd] = useState(project.target_end_date ?? "");

  // Reset when project changes
  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setColor(project.color ?? "#8b5cf6");
    setClient(project.client_name ?? "");
    setIsClient(!!project.is_client_project);
    setStart(project.start_date ?? "");
    setEnd(project.target_end_date ?? "");
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    name !== project.name ||
    description !== (project.description ?? "") ||
    color !== (project.color ?? "#8b5cf6") ||
    client !== (project.client_name ?? "") ||
    isClient !== !!project.is_client_project ||
    start !== (project.start_date ?? "") ||
    end !== (project.target_end_date ?? "");

  const save = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    await update.mutateAsync({
      id: project.id,
      name: name.trim(),
      description: description.trim() || null,
      color,
      client_name: client.trim() || null,
      is_client_project: isClient,
      start_date: start || null,
      target_end_date: end || null,
    });
    toast.success("Project updated");
  };

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete "${project.name}"?`,
      description: "Every task, comment and attachment in this project will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete project",
      tone: "destructive",
    });
    if (!ok) return;
    await remove.mutateAsync(project.id);
    navigate({ to: "/app" });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="proj-name">Name</Label>
        <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="proj-desc">Description</Label>
        <Textarea id="proj-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="proj-color">Color</Label>
          <div className="flex items-center gap-2">
            <input
              id="proj-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-border bg-background"
            />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono text-sm" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proj-client">Client name</Label>
          <Input
            id="proj-client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Acme Inc."
          />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
        <div>
          <p className="text-sm font-medium">Treat as client project</p>
          <p className="text-xs text-muted-foreground">Enables the client portal, deliverables and change orders.</p>
        </div>
        <Switch checked={isClient} onCheckedChange={setIsClient} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="proj-start">Start date</Label>
          <Input id="proj-start" type="date" value={start ?? ""} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proj-end">Target end date</Label>
          <Input id="proj-end" type="date" value={end ?? ""} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button
          variant="outline"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete project
        </Button>
        <Button
          onClick={save}
          disabled={!dirty || update.isPending}
          className="bg-aura-gradient text-primary-foreground hover:opacity-90"
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
