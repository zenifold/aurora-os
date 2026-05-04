import { useState } from "react";
import type { View } from "@/lib/types";
import { useDeleteView } from "@/hooks/use-views";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Plus } from "lucide-react";
import { useCreateView } from "@/hooks/use-views";

export function ViewTabs({ views, activeId, onSelect, projectId }: { views: View[]; activeId: string | null; onSelect: (id: string) => void; projectId: string }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const create = useCreateView(projectId);
  const remove = useDeleteView(projectId);

  const submit = async () => {
    if (!name.trim()) return setAdding(false);
    const v = await create.mutateAsync({ name: name.trim() });
    onSelect(v.id);
    setName("");
    setAdding(false);
  };

  return (
    <div className="mt-3 flex items-center gap-1">
      {views.map((v) => (
        <div
          key={v.id}
          className={`group flex items-center gap-1 rounded-md px-2.5 py-1 text-sm transition-colors ${
            activeId === v.id
              ? "bg-aura-gradient-subtle font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <button onClick={() => onSelect(v.id)}>{v.name}</button>
          {!v.is_default && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(v.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete view
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ))}
      {adding ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") { setAdding(false); setName(""); }
          }}
          placeholder="View name"
          className="h-7 w-32 text-sm"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
