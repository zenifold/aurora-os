import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Target,
  Flag,
  UsersRound,
  Activity,
  FileEdit,
  Users,
  StickyNote,
  Mic,
  FileText,
  DollarSign,
  MoreHorizontal,
} from "lucide-react";

interface Props {
  projectId: string;
  /** Legacy: ignored. Kept for callers still passing `group`. */
  group?: "plan" | "delivery" | "workspace";
}

const ICON = "mr-2 h-4 w-4 text-muted-foreground";

export function ProjectActionsMenu({ projectId }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="mr-1.5 h-4 w-4" /> More
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Plan</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/app/p/$projectId/sprints" params={{ projectId }}>
            <Target className={ICON} /> Sprints
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/p/$projectId/milestones" params={{ projectId }}>
            <Flag className={ICON} /> Milestones
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/p/$projectId/allocations" params={{ projectId }}>
            <UsersRound className={ICON} /> Allocations
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Delivery</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/app/p/$projectId/health" params={{ projectId }}>
            <Activity className={ICON} /> Health
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/p/$projectId/change-orders" params={{ projectId }}>
            <FileEdit className={ICON} /> Change orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/p/$projectId/financials" params={{ projectId }}>
            <DollarSign className={ICON} /> Financials
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/p/$projectId/clients" params={{ projectId }}>
            <Users className={ICON} /> Clients
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/app/p/$projectId/documents" params={{ projectId }}>
            <FileText className={ICON} /> Documents
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/meetings">
            <Mic className={ICON} /> Meetings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
