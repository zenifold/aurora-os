import { useState } from "react";
import {
  useMeetingParticipants,
  useAddParticipant,
  useRemoveParticipant,
} from "@/hooks/use-meetings";
import { useWorkspaceMembers } from "@/hooks/use-comments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, User } from "lucide-react";

interface Props {
  meetingId: string;
}

export function ParticipantsPanel({ meetingId }: Props) {
  const { data: participants = [] } = useMeetingParticipants(meetingId);
  const { data: members = [] } = useWorkspaceMembers();
  const add = useAddParticipant();
  const remove = useRemoveParticipant();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const linkedIds = new Set(participants.map((p) => p.user_id).filter(Boolean) as string[]);

  const addFromMember = (m: { id: string; display_name?: string | null }) => {
    add.mutate({
      meeting_id: meetingId,
      email: `${m.id.slice(0, 8)}@workspace.local`,
      name: m.display_name ?? null,
      user_id: m.id,
    });
  };

  const addManual = () => {
    if (!email.trim()) return;
    add.mutate({
      meeting_id: meetingId,
      email: email.trim(),
      name: name.trim() || null,
    });
    setEmail("");
    setName("");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Participants ({participants.length})
        </h3>

        {participants.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            No participants yet. Add people who attended this meeting to improve assignee matching.
          </p>
        ) : (
          <ul className="space-y-1">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                    {(p.name ?? p.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{p.name ?? p.email}</p>
                    {p.name && (
                      <p className="truncate text-[10px] text-muted-foreground">{p.email}</p>
                    )}
                  </div>
                  {p.user_id && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                      <User className="mr-0.5 h-2 w-2" /> linked
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => remove.mutate({ id: p.id, meeting_id: meetingId })}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove participant"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add from workspace */}
      {members.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Add from workspace
          </p>
          <Select onValueChange={(v) => {
            const m = members.find((mm) => mm.id === v);
            if (m) addFromMember(m as never);
          }}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select member…" />
            </SelectTrigger>
            <SelectContent>
              {members
                .filter((m) => !linkedIds.has(m.id))
                .map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.display_name ?? m.id.slice(0, 8)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Add manually */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Add external
        </p>
        <div className="flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-8 text-xs"
          />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            type="email"
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={addManual} disabled={!email.trim() || add.isPending} className="h-8 shrink-0">
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
