import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export function AssigneeAvatars({
  ids,
  max = 3,
  size = 22,
  className,
}: {
  ids: string[];
  max?: number;
  size?: number;
  className?: string;
}) {
  const { data: members = [] } = useWorkspaceMembers();
  if (!ids?.length) return null;
  const byId = new Map(members.map((m) => [m.id, m]));
  const visible = ids.slice(0, max);
  const overflow = Math.max(0, ids.length - visible.length);
  return (
    <div className={cn("flex -space-x-1.5", className)}>
      {visible.map((id) => {
        const m = byId.get(id);
        return (
          <Avatar
            key={id}
            className="ring-2 ring-background"
            style={{ height: size, width: size }}
            title={m?.display_name ?? "Member"}
          >
            <AvatarImage src={m?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[9px]">
              {initials(m?.display_name)}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {overflow > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-muted text-[9px] font-medium ring-2 ring-background"
          style={{ height: size, width: size }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
