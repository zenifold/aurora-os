import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listProjectRequirements,
  createProjectRequirement,
  updateProjectRequirement,
  deleteProjectRequirement,
} from "@/lib/requirements.functions";
import { useProject } from "@/hooks/use-projects";
import { toast } from "sonner";

export const Route = createFileRoute("/app/p/$projectId/requirements")({
  component: RequirementsPage,
});

function RequirementsPage() {
  const { projectId } = Route.useParams();
  const list = useServerFn(listProjectRequirements);
  const create = useServerFn(createProjectRequirement);
  const update = useServerFn(updateProjectRequirement);
  const remove = useServerFn(deleteProjectRequirement);
  const qc = useQueryClient();
  const { data: project } = useProject(projectId);

  const { data: rows = [] } = useQuery({
    queryKey: ["project-requirements", projectId],
    queryFn: () => list({ data: { project_id: projectId } }),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const createMut = useMutation({
    mutationFn: () => create({ data: { project_id: projectId, title, description, priority } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-requirements", projectId] });
      setOpen(false);
      setTitle(""); setDescription(""); setPriority("medium");
      toast.success("Requirement added");
    },
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/app/p/$projectId" params={{ projectId }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-lg font-semibold tracking-tight">Requirements</h1>
          <p className="text-xs text-muted-foreground truncate">{project?.name}</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New requirement</Button>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {rows.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No requirements captured yet. Add the first one — they carry over from any source deal automatically.
          </Card>
        ) : (
          <div className="space-y-2 max-w-4xl">
            {rows.map((r: import("@/lib/requirements.functions").ProjectRequirement) => (
              <Card key={r.id} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium">{r.title}</div>
                    <Badge variant="outline" className="text-xs capitalize">{r.priority}</Badge>
                    <Badge variant="secondary" className="text-xs capitalize">{r.status}</Badge>
                    {r.source === "presales" && <Badge className="text-xs">From deal</Badge>}
                  </div>
                  {r.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.description}</p>}
                </div>
                <Select
                  value={r.status}
                  onValueChange={async (v) => {
                    await update({ data: { id: r.id, status: v } });
                    qc.invalidateQueries({ queryKey: ["project-requirements", projectId] });
                  }}
                >
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="met">Met</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm(`Delete "${r.title}"?`)) return;
                    await remove({ data: { id: r.id } });
                    qc.invalidateQueries({ queryKey: ["project-requirements", projectId] });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New requirement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!title.trim() || createMut.isPending} onClick={() => createMut.mutate()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
