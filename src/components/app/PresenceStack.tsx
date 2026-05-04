import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PresenceUser } from "@/hooks/use-presence";

export function PresenceStack({
  users,
  max = 4,
}: {
  users: PresenceUser[];
  max?: number;
}) {
  if (users.length === 0) return null;
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center -space-x-2">
        {visible.map((u) => (
          <Tooltip key={u.user_id}>
            <TooltipTrigger asChild>
              <div
                className="relative inline-block rounded-full ring-2 ring-background transition-transform hover:z-10 hover:scale-110"
                style={{ boxShadow: `0 0 0 2px ${u.color}` }}
              >
                <Avatar className="h-7 w-7">
                  {u.avatar_url && (
                    <AvatarImage src={u.avatar_url} alt={u.display_name} />
                  )}
                  <AvatarFallback className="text-[10px] font-medium">
                    {u.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: u.color }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span className="text-xs">{u.display_name} is here</span>
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <div className="z-0 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
            +{overflow}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
