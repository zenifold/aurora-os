import { useMemo, useState } from "react";
import {
  PRESETS,
  type PresetId,
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
  type SavedView,
} from "@/hooks/use-saved-views";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import {
  Inbox,
  AlertCircle,
  CalendarClock,
  CalendarRange,
  Flame,
  CalendarOff,
  Plus,
  Star,
  Trash2,
  MoreHorizontal,
  Bookmark,
} from "lucide-react";
import type { Filter } from "@/lib/types";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Inbox,
  AlertCircle,
  CalendarClock,
  CalendarRange,
  Flame,
  CalendarOff,
  Bookmark,
};

export type ActiveView =
  | { kind: "all" }
  | { kind: "preset"; id: PresetId }
  | { kind: "saved"; id: string };

export function SavedViewsBar({
  active,
  onChange,
  currentFilters,
}: {
  active: ActiveView;
  onChange: (v: ActiveView) => void;
  currentFilters?: Filter[];
}) {
  const { data: saved = [] } = useSavedViews();
  const create = useCreateSavedView();
  const remove = useDeleteSavedView();
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");

  const pinned = useMemo(() => saved.filter((s) => s.is_pinned), [saved]);
  const others = useMemo(() => saved.filter((s) => !s.is_pinned), [saved]);

  const submit = async () => {
    if (!name.trim()) return;
    const v = await create.mutateAsync({
      name: name.trim(),
      filters: currentFilters ?? [],
      is_pinned: true,
    });
    setName("");
    setNewOpen(false);
    onChange({ kind: "saved", id: v.id });
  };

  const Chip = ({
    label,
    icon: Icon,
    isActive,
    onClick,
    onDelete,
  }: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isActive: boolean;
    onClick: () => void;
    onDelete?: () => void;
  }) => (
    <div
      className={`group flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
        isActive
          ? "border-transparent bg-aura-gradient-subtle font-medium text-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <button onClick={onClick} className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="ml-0.5 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Remove view"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip
        label="All"
        icon={Inbox}
        isActive={active.kind === "all"}
        onClick={() => onChange({ kind: "all" })}
      />
      {PRESETS.map((p) => {
        const Icon = ICONS[p.icon] ?? Bookmark;
        return (
          <Chip
            key={p.id}
            label={p.name}
            icon={Icon}
            isActive={active.kind === "preset" && active.id === p.id}
            onClick={() => onChange({ kind: "preset", id: p.id })}
          />
        );
      })}

      {pinned.map((v) => (
        <Chip
          key={v.id}
          label={v.name}
          icon={Star}
          isActive={active.kind === "saved" && active.id === v.id}
          onClick={() => onChange({ kind: "saved", id: v.id })}
          onDelete={() => remove.mutate(v.id)}
        />
      ))}

      {(others.length > 0 || saved.length === 0) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
              <MoreHorizontal className="h-3 w-3" /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>My saved views</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {others.length === 0 ? (
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                No saved views yet
              </DropdownMenuItem>
            ) : (
              others.map((v: SavedView) => (
                <DropdownMenuItem
                  key={v.id}
                  onClick={() => onChange({ kind: "saved", id: v.id })}
                >
                  <Bookmark className="mr-2 h-3.5 w-3.5" /> {v.name}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Save current filters…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => setNewOpen(true)}
      >
        <Plus className="h-3 w-3" /> Save view
      </Button>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="View name (e.g. Sprint 12 backlog)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
