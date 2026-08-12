import { useEffect, useState } from "react";
import { addHours, addMinutes, endOfDay, formatDistanceToNow } from "date-fns";
import { Smile, BellOff, Plane, X, Check, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import {
  useMyStatus,
  useUpdateMyStatus,
  isStatusActive,
  isDndActive,
  isOooActive,
} from "@/hooks/use-user-status";
import { cn } from "@/lib/utils";

const PRESETS = [
  { emoji: "💻", text: "Heads down", durationMin: 60 },
  { emoji: "🍴", text: "At lunch", durationMin: 60 },
  { emoji: "📅", text: "In a meeting", durationMin: 30 },
  { emoji: "🤒", text: "Out sick", durationMin: 8 * 60 },
  { emoji: "🏝️", text: "Vacationing", durationMin: 24 * 60 },
];

const DND_OPTIONS = [
  { label: "30 minutes", at: () => addMinutes(new Date(), 30) },
  { label: "1 hour", at: () => addHours(new Date(), 1) },
  { label: "2 hours", at: () => addHours(new Date(), 2) },
  { label: "Until tomorrow", at: () => endOfDay(new Date()) },
];

export function StatusMenu({ trigger }: { trigger?: React.ReactNode }) {
  const { data: status } = useMyStatus();
  const update = useUpdateMyStatus();
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState<string | null>(status?.emoji ?? null);
  const [text, setText] = useState<string>(status?.text ?? "");
  const [pickEmoji, setPickEmoji] = useState(false);

  const active = isStatusActive(status);
  const dnd = isDndActive(status);
  const ooo = isOooActive(status);

  // Keep local editor state synced with server state whenever it changes
  // (e.g. after mutation, realtime update, or initial load). This prevents
  // the next save from clobbering server values with stale local state.
  useEffect(() => {
    setEmoji(status?.emoji ?? null);
    setText(status?.text ?? "");
  }, [status?.emoji, status?.text, status?.updated_at]);


  const applyPreset = (p: typeof PRESETS[number]) => {
    update.mutate({
      emoji: p.emoji,
      text: p.text,
      clear_at: addMinutes(new Date(), p.durationMin).toISOString(),
    });
    setOpen(false);
  };

  const saveCustom = () => {
    update.mutate({
      emoji: emoji,
      text: text.trim() || null,
      clear_at: addHours(new Date(), 4).toISOString(),
    });
    setOpen(false);
  };

  const clearStatus = () => {
    update.mutate({ emoji: null, text: null, clear_at: null });
  };

  const setDnd = (until: Date | null) => {
    update.mutate({ dnd_until: until ? until.toISOString() : null });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
            {active && status?.emoji ? (
              <span className="text-base leading-none">{status.emoji}</span>
            ) : (
              <Smile className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="max-w-[140px] truncate text-xs">
              {active && status?.text ? status.text : "Set status"}
            </span>
            {dnd && <BellOff className="h-3 w-3 text-amber-500" />}
            {ooo && <Plane className="h-3 w-3 text-emerald-500" />}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Custom status
          </div>
          <div className="flex items-center gap-2">
            <Popover open={pickEmoji} onOpenChange={setPickEmoji}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-lg">
                  {emoji ?? "😀"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <EmojiPicker
                  onPick={(e) => {
                    setEmoji(e);
                    setPickEmoji(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's up?"
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCustom();
              }}
            />
            <Button size="sm" onClick={saveCustom} disabled={!emoji && !text.trim()}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
          {active && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Clears {status?.clear_at ? formatDistanceToNow(new Date(status.clear_at), { addSuffix: true }) : "manually"}
              </span>
              <button onClick={clearStatus} className="inline-flex items-center gap-1 hover:text-destructive">
                <X className="h-3 w-3" /> Clear
              </button>
            </div>
          )}
        </div>

        <div className="border-b border-border p-2">
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Presets
          </div>
          {PRESETS.map((p) => (
            <button
              key={p.text}
              onClick={() => applyPreset(p)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span className="text-base">{p.emoji}</span>
              <span>{p.text}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {p.durationMin >= 60 ? `${p.durationMin / 60}h` : `${p.durationMin}m`}
              </span>
            </button>
          ))}
        </div>

        <div className="p-2">
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Notifications
          </div>
          {dnd ? (
            <button
              onClick={() => setDnd(null)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-amber-600 hover:bg-accent"
            >
              <Bell className="h-4 w-4" />
              Resume notifications (paused {formatDistanceToNow(new Date(status!.dnd_until!), { addSuffix: true })})
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent")}>
                  <BellOff className="h-4 w-4" />
                  Pause notifications
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {DND_OPTIONS.map((o) => (
                  <DropdownMenuItem key={o.label} onClick={() => setDnd(o.at())}>
                    {o.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDnd(null)} className="text-destructive">
                  Off
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
