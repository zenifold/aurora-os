import { useState } from "react";
import type { View } from "@/lib/types";
import { useDeleteView, useUpdateView, useCreateView } from "@/hooks/use-views";
import { useIsWorkspaceOwner } from "@/hooks/use-workspace-role";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Trash2,
  Plus,
  Table as TableIcon,
  KanbanSquare,
  Calendar as CalendarIcon,
  GanttChart,
  Frame,
  Lock,
  Unlock,
  Copy,
} from "lucide-react";

const VIEW_TYPES: { value: View["view_type"]; label: string; icon: typeof TableIcon }[] = [
  { value: "table", label: "Table", icon: TableIcon },
  { value: "kanban", label: "Kanban", icon: KanbanSquare },
  { value: "canvas", label: "Canvas", icon: Frame },
  { value: "calendar", label: "Calendar", icon: CalendarIcon },
  { value: "timeline", label: "Timeline", icon: GanttChart },
];

export function ViewTabs({
  views,
  activeId,
  onSelect,
  projectId,
}: {
  views: View[];
  activeId: string | null;
  onSelect: (id: string) => void;
  projectId: string;
}) {
  const [dialogType, setDialogType] = useState<View["view_type"] | null>(null);
  const [name, setName] = useState("");
  const create = useCreateView(projectId);
  const update = useUpdateView(projectId);
  const remove = useDeleteView(projectId);
  const isOwner = useIsWorkspaceOwner();

  const submit = async () => {
    if (!name.trim() || !dialogType) return;
    const v = await create.mutateAsync({ name: name.trim(), view_type: dialogType });
    onSelect(v.id);
    setName("");
    setDialogType(null);
  };

  const duplicate = async (v: View) => {
    const dup = await create.mutateAsync({
      name: `${v.name} (copy)`,
      view_type: v.view_type,
      filters: v.filters,
      sorts: v.sorts,
      group_by: v.group_by,
    });
    onSelect(dup.id);
  };

  const toggleLock = (v: View) => {
    update.mutate({
      id: v.id,
      config: { ...(v.config ?? {}), locked: !v.config?.locked },
    });
  };

  return (
    <div className="mt-3 flex items-center gap-1">
      {views.map((v) => {
        const meta = VIEW_TYPES.find((t) => t.value === v.view_type) ?? VIEW_TYPES[0];
        const Icon = meta.icon;
        const locked = !!v.config?.locked;
        return (
          <div
            key={v.id}
            className={`group flex items-center gap-1 rounded-md px-2.5 py-1 text-sm transition-colors ${
              activeId === v.id
                ? "bg-aura-gradient-subtle font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <button onClick={() => onSelect(v.id)} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {v.name}
              {locked && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Locked view" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="opacity-0 group-hover:opacity-100" aria-label="View actions">
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => duplicate(v)}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate to customize
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem onClick={() => toggleLock(v)}>
                    {locked ? (
                      <>
                        <Unlock className="mr-2 h-4 w-4" /> Unlock view
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" /> Lock view
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {!v.is_default && (isOwner || !locked) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => remove.mutate(v.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete view
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>New view</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {VIEW_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <DropdownMenuItem
                key={t.value}
                onClick={() => {
                  setName(t.label);
                  setDialogType(t.value);
                }}
              >
                <Icon className="mr-2 h-4 w-4" /> {t.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!dialogType} onOpenChange={(o) => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New {dialogType} view</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="View name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogType(null)}>Cancel</Button>
            <Button onClick={submit}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
