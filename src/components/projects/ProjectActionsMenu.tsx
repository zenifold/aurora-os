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
} from "lucide-react";

type Group = "plan" | "delivery" | "workspace";

interface Props {
  projectId: string;
  group: Group;
}

const ICON = "mr-2 h-4 w-4 text-muted-foreground";

export function ProjectActionsMenu({ projectId, group }: Props) {
  if (group === "plan") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            Plan <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Planning</DropdownMenuLabel>
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
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (group === "delivery") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            Delivery <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Delivery & client</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link to="/app/p/$projectId/health" params={{ projectId }}>
              <Activity className={ICON} /> Health
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/app/p/$projectId/financials" params={{ projectId }}>
              <DollarSign className={ICON} /> Financials
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/app/p/$projectId/change-orders" params={{ projectId }}>
              <FileEdit className={ICON} /> Change orders
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/app/p/$projectId/clients" params={{ projectId }}>
              <Users className={ICON} /> Client portal
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          Workspace <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Knowledge & files</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/app/notes" search={{ project: projectId, archived: false }}>
            <StickyNote className={ICON} /> Notes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/meetings" search={{ project: projectId }}>
            <Mic className={ICON} /> Meetings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/p/$projectId/documents" params={{ projectId }}>
            <FileText className={ICON} /> Documents
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
