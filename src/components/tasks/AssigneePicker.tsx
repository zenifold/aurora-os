import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useWorkspaceMembers } from "@/hooks/use-comments";
import { cn } from "@/lib/utils";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AssigneePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { data: members = [] } = useWorkspaceMembers();
  const [open, setOpen] = useState(false);

  const selected = members.filter((m) => value.includes(m.id));
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((m) => (
        <span
          key={m.id}
          className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-0.5 pl-0.5 pr-2 text-xs"
        >
          <Avatar className="h-5 w-5">
            <AvatarImage src={m.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {initials(m.display_name)}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[120px] truncate">{m.display_name ?? "Member"}</span>
          <button
            type="button"
            onClick={() => toggle(m.id)}
            className="opacity-0 transition group-hover:opacity-100"
            aria-label="Remove assignee"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            {selected.length === 0 ? "Assign" : "Add"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search members…" />
            <CommandList>
              <CommandEmpty>No members.</CommandEmpty>
              <CommandGroup>
                {members.map((m) => {
                  const active = value.includes(m.id);
                  return (
                    <CommandItem
                      key={m.id}
                      value={m.display_name ?? m.id}
                      onSelect={() => toggle(m.id)}
                      className="gap-2"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {initials(m.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">
                        {m.display_name ?? "Member"}
                      </span>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
