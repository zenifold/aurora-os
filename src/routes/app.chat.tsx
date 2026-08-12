import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useChannels, useCreateChannel, useChannelUnreadCounts, type ChannelRow, type UnreadRow } from "@/hooks/use-channels";
import { useProjects } from "@/hooks/use-projects";
import { ChannelView, ChannelEmptyState } from "@/components/chat/ChannelView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Hash, Lock, Plus, MessageSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/chat")({
  component: ChatPage,
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s.c === "string" ? (s.c as string) : undefined,
  }),
});

function ChatPage() {
  const { c: selectedId } = Route.useSearch();
  const navigate = useNavigate({ from: "/app/chat" });
  const { data: channels = [], isLoading } = useChannels();
  const { data: unread } = useChannelUnreadCounts();
  const { data: projects = [] } = useProjects();
  const projectName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const [filter, setFilter] = useState("");

  // Default-pick #general (workspace) if none selected
  useEffect(() => {
    if (selectedId || channels.length === 0) return;
    const general =
      channels.find((c) => c.scope === "workspace" && c.slug === "general") ?? channels[0];
    if (general) {
      void navigate({ search: { c: general.id } });
    }
  }, [selectedId, channels, navigate]);

  const grouped = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = channels.filter((c) =>
      f ? c.name.toLowerCase().includes(f) : true,
    );
    const ws: ChannelRow[] = [];
    const proj: ChannelRow[] = [];
    const other: ChannelRow[] = [];
    for (const c of filtered) {
      if (c.scope === "workspace") ws.push(c);
      else if (c.scope === "project") proj.push(c);
      else other.push(c);
    }
    return { ws, proj, other };
  }, [channels, filter]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      {/* Channel rail */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4" /> Chat
          </div>
          <NewChannelDialog />
        </div>
        <div className="px-3 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter channels"
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <div className="px-2 py-4 text-xs text-muted-foreground">Loading…</div>
          ) : (
            <>
              <Section title="Workspace">
                {grouped.ws.map((c) => (
                  <ChannelLink
                    key={c.id}
                    channel={c}
                    active={c.id === selectedId}
                    unread={unread?.[c.id]}
                    onClick={() => navigate({ search: { c: c.id } })}
                  />
                ))}
              </Section>
              <Section title="Projects">
                {grouped.proj.map((c) => (
                  <ChannelLink
                    key={c.id}
                    channel={c}
                    active={c.id === selectedId}
                    unread={unread?.[c.id]}
                    label={c.scope_id ? projectName.get(c.scope_id) ?? c.name : c.name}
                    onClick={() => navigate({ search: { c: c.id } })}
                  />
                ))}
                {grouped.proj.length === 0 && (
                  <div className="px-2 py-1 text-[11px] text-muted-foreground">
                    No project channels yet.
                  </div>
                )}
              </Section>
              {grouped.other.length > 0 && (
                <Section title="Direct messages">
                  {grouped.other.map((c) => (
                    <ChannelLink
                      key={c.id}
                      channel={c}
                      active={c.id === selectedId}
                      unread={unread?.[c.id]}
                      onClick={() => navigate({ search: { c: c.id } })}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </nav>
      </aside>

      {/* Mobile channel list (only when no channel selected) */}
      {!selectedId && (
        <div className="flex w-full flex-col md:hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" /> Chat
            </div>
            <NewChannelDialog />
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-2">
            {channels.map((c) => (
              <ChannelLink
                key={c.id}
                channel={c}
                active={false}
                unread={unread?.[c.id]}
                onClick={() => navigate({ search: { c: c.id } })}
              />
            ))}
          </nav>
        </div>
      )}

      {/* Conversation pane */}
      <main className={cn("min-w-0 flex-1 flex-col bg-background", selectedId ? "flex" : "hidden md:flex")}>
        {selectedId ? <ChannelView channelId={selectedId} /> : <ChannelEmptyState />}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ChannelLink({
  channel,
  active,
  label,
  unread,
  onClick,
}: {
  channel: ChannelRow;
  active: boolean;
  label?: string;
  unread?: UnreadRow;
  onClick: () => void;
}) {
  const Icon = channel.is_private ? Lock : Hash;
  const hasUnread = !active && (unread?.unread_count ?? 0) > 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        active
          ? "bg-aura-gradient-subtle font-medium text-foreground"
          : hasUnread
            ? "font-semibold text-foreground hover:bg-accent"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{label ?? channel.name}</span>
      {hasUnread && (
        <span
          className={cn(
            "ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold",
            unread?.has_mention
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary/20 text-primary",
          )}
        >
          {unread!.unread_count}
        </span>
      )}
    </button>
  );
}

function NewChannelDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const create = useCreateChannel();
  const navigate = useNavigate({ from: "/app/chat" });

  const submit = async () => {
    if (!name.trim()) return;
    const c = await create.mutateAsync({
      name: name.trim(),
      scope: "workspace",
      is_private: isPrivate,
    });
    setOpen(false);
    setName("");
    setIsPrivate(false);
    navigate({ search: { c: c.id } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. design-reviews"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between rounded border border-border p-3">
            <div>
              <p className="text-sm font-medium">Private</p>
              <p className="text-xs text-muted-foreground">Only invited people can see this channel.</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
