import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { useState } from "react";
import {
  useRateCards,
  useRateCardEntries,
  useUpsertRateCard,
  useDeleteRateCard,
  useUpsertRateCardEntry,
  useDeleteRateCardEntry,
  type RateCard,
} from "@/hooks/use-rate-cards";
import { useTeamMembers } from "@/hooks/use-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Star, Archive } from "lucide-react";

export const Route = createFileRoute("/app/settings/rate-cards")({
  component: () => (
    <RoleGuard min="manager">
      <RateCardsPage />
    </RoleGuard>
  ),
});

function RateCardsPage() {
  const { data: cards = [], isLoading } = useRateCards();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = cards.find((c) => c.id === selectedId) ?? cards[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rate cards</h1>
          <p className="text-sm text-muted-foreground">
            Define hourly bill and cost rates by role or person. Attach a card to any project.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-aura-gradient text-primary-foreground hover:opacity-90">
              <Plus className="mr-1.5 h-4 w-4" /> New rate card
            </Button>
          </DialogTrigger>
          <RateCardDialog
            onClose={() => setCreateOpen(false)}
            onSaved={(c) => {
              setSelectedId(c.id);
              setCreateOpen(false);
            }}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No rate cards yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-1">
            {cards.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  (selected?.id === c.id)
                    ? "bg-accent font-medium"
                    : "hover:bg-accent/50"
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  {c.is_default && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                  {c.is_archived && <Archive className="h-3 w-3 text-muted-foreground" />}
                  {c.name}
                </span>
                <Badge variant="outline" className="font-mono text-[10px]">{c.currency}</Badge>
              </button>
            ))}
          </aside>
          {selected && <RateCardDetail card={selected} />}
        </div>
      )}
    </div>
  );
}

function RateCardDialog({
  card,
  onClose,
  onSaved,
}: {
  card?: RateCard;
  onClose: () => void;
  onSaved?: (c: RateCard) => void;
}) {
  const [name, setName] = useState(card?.name ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [currency, setCurrency] = useState(card?.currency ?? "USD");
  const [isDefault, setIsDefault] = useState(card?.is_default ?? false);
  const upsert = useUpsertRateCard();

  const submit = async () => {
    if (!name.trim()) return;
    const saved = await upsert.mutateAsync({
      ...(card ? { id: card.id } : {}),
      name: name.trim(),
      description: description || null,
      currency: currency.toUpperCase(),
      is_default: isDefault,
    });
    onSaved?.(saved);
    onClose();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{card ? "Edit rate card" : "New rate card"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="rc-name">Name</Label>
          <Input id="rc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard 2026" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rc-desc">Description</Label>
          <Textarea id="rc-desc" rows={2} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="rc-curr">Currency</Label>
            <Input id="rc-curr" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input id="rc-default" type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            <Label htmlFor="rc-default" className="cursor-pointer text-sm">Default for new projects</Label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!name.trim() || upsert.isPending}>
          {upsert.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function RateCardDetail({ card }: { card: RateCard }) {
  const { data: entries = [] } = useRateCardEntries(card.id);
  const { data: members = [] } = useTeamMembers();
  const upsertEntry = useUpsertRateCardEntry();
  const deleteEntry = useDeleteRateCardEntry();
  const deleteCard = useDeleteRateCard();
  const [editOpen, setEditOpen] = useState(false);

  const [newRole, setNewRole] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newBill, setNewBill] = useState("");
  const [newCost, setNewCost] = useState("");

  const addEntry = async () => {
    if (!newRole.trim() && !newUserId) return;
    await upsertEntry.mutateAsync({
      rate_card_id: card.id,
      role_name: newRole.trim() || null,
      user_id: newUserId || null,
      bill_rate: Number(newBill) || 0,
      cost_rate: Number(newCost) || 0,
    });
    setNewRole("");
    setNewUserId("");
    setNewBill("");
    setNewCost("");
  };

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {card.name}
            {card.is_default && <Badge variant="outline" className="text-[10px]">Default</Badge>}
            {card.is_archived && <Badge variant="outline" className="text-[10px]">Archived</Badge>}
          </h2>
          {card.description && <p className="text-sm text-muted-foreground">{card.description}</p>}
        </div>
        <div className="flex gap-1.5">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
            </DialogTrigger>
            <RateCardDialog card={card} onClose={() => setEditOpen(false)} />
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(`Delete "${card.name}"?`)) deleteCard.mutate(card.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3">Role / Person</th>
              <th className="py-2 pr-3 text-right">Bill /h</th>
              <th className="py-2 pr-3 text-right">Cost /h</th>
              <th className="py-2 pr-3 text-right">Margin</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const member = members.find((m) => m.user_id === e.user_id);
              const margin = Number(e.bill_rate) - Number(e.cost_rate);
              return (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">
                    {e.role_name || member?.user_id?.slice(0, 8) || "—"}
                    {e.user_id && e.role_name && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{member?.user_id?.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">{Number(e.bill_rate).toFixed(0)} {card.currency}</td>
                  <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{Number(e.cost_rate).toFixed(0)}</td>
                  <td className={`py-2 pr-3 text-right font-mono ${margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {margin.toFixed(0)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => deleteEntry.mutate({ id: e.id, rate_card_id: card.id })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No entries yet — add a role-based or person-based rate below.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-dashed border-border p-3">
        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Add entry</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_100px_100px_auto]">
          <Input placeholder="Role (e.g. Senior Dev)" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
          <Select value={newUserId || "none"} onValueChange={(v) => setNewUserId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Person (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— No specific person —</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.user_id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" inputMode="decimal" placeholder="Bill" value={newBill} onChange={(e) => setNewBill(e.target.value)} />
          <Input type="number" inputMode="decimal" placeholder="Cost" value={newCost} onChange={(e) => setNewCost(e.target.value)} />
          <Button onClick={addEntry} disabled={(!newRole.trim() && !newUserId) || upsertEntry.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Person-specific rates override role rates for that user. Role rates apply when a user doesn't have an explicit entry.
        </p>
      </div>
    </div>
  );
}
