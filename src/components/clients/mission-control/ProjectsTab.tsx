import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Archive, ArchiveRestore, Trash2, Pencil, MoreHorizontal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { ProjectPhaseChip } from "@/components/projects/ProjectPhaseChip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Project = {
  id: string;
  name: string;
  health: string | null;
  is_archived: boolean;
  target_end_date: string | null;
  lifecycle?: string | null;
};

export function ProjectsTab({
  accountId,
  projects,
  onNew,
}: {
  accountId: string;
  projects: Project[];
  onNew: () => void;
}) {
  const qc = useQueryClient();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const bucket = (lc: string) =>
    projects.filter((p) => !p.is_archived && (p.lifecycle ?? "active") === lc);

  const active = bucket("active");
  const proposed = bucket("proposed");
  const onHold = bucket("on_hold");
  const atRisk = active.filter((p) => p.health === "at_risk" || p.health === "off_track" || p.health === "blocked");
  const archived = projects.filter((p) => p.is_archived || p.lifecycle === "complete" || p.lifecycle === "archived");

  const Section = ({ title, items, tone }: { title: string; items: Project[]; tone?: string }) =>
    items.length === 0 ? null : (
      <div>
        <div className={`text-xs uppercase tracking-wide mb-2 ${tone ?? "text-muted-foreground"}`}>
          {title} ({items.length})
        </div>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-border first:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to="/app/p/$projectId" params={{ projectId: p.id }} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><ProjectPhaseChip projectId={p.id} /></td>
                  <td className="px-4 py-3">
                    {p.health
                      ? <Badge variant="outline" className="capitalize">{p.health.replace(/_/g, " ")}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {p.target_end_date ? new Date(p.target_end_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 w-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          const n = window.prompt("Rename project", p.name);
                          if (n && n.trim() && n !== p.name) {
                            updateProject.mutate({ id: p.id, name: n.trim() }, {
                              onSuccess: () => qc.invalidateQueries({ queryKey: ["client-account", accountId] }),
                            });
                          }
                        }}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateProject.mutate(
                          { id: p.id, is_archived: !p.is_archived },
                          { onSuccess: () => qc.invalidateQueries({ queryKey: ["client-account", accountId] }) },
                        )}>
                          {p.is_archived ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Restore</> : <><Archive className="h-4 w-4 mr-2" /> Archive</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => {
                          if (window.confirm(`Delete "${p.name}"?`)) {
                            deleteProject.mutate(p.id, { onSuccess: () => qc.invalidateQueries({ queryKey: ["client-account", accountId] }) });
                          }
                        }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );

  if (projects.length === 0) {
    return (
      <Card className="p-8 text-center space-y-3">
        <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No projects yet.</p>
        <Button onClick={onNew}><Plus className="h-4 w-4 mr-1" /> New project</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={onNew}><Plus className="h-4 w-4 mr-1" /> New project</Button>
      </div>
      <Section title="At risk" items={atRisk} tone="text-destructive" />
      <Section title="Active" items={active} />
      <Section title="Potential" items={proposed} />
      <Section title="On hold" items={onHold} />
      <Section title="Archived & complete" items={archived} />
    </div>
  );
}
