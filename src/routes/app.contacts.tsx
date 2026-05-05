import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useDeals,
} from "@/hooks/use-crm";
import { formatDealValue, type Contact } from "@/lib/crm-types";
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
import { Plus, Loader2, Search, Mail, Phone, Building2, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/app/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const { data: contacts = [], isLoading } = useContacts();
  const { data: deals = [] } = useDeals();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q),
    );
  }, [contacts, query]);

  const dealCountBy = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    for (const d of deals) {
      if (!d.contact_id) continue;
      const cur = m.get(d.contact_id) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += d.value ?? 0;
      m.set(d.contact_id, cur);
    }
    return m;
  }, [deals]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{ws?.name}</div>
            <h1 className="text-lg font-semibold lg:text-xl">Contacts</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search contacts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-64 pl-8"
            />
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> New contact
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {contacts.length === 0
                ? "No contacts yet. Add your first one to start linking deals."
                : "No contacts match that search."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => {
              const stats = dealCountBy.get(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setEditing(c)}
                  className="rounded-lg border border-border bg-card p-4 text-left transition hover:shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.name}</div>
                      {c.title && <div className="truncate text-xs text-muted-foreground">{c.title}</div>}
                      <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        {c.company && (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3" /> {c.company}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="h-3 w-3" /> {c.email}
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </div>
                        )}
                      </div>
                      {stats && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {stats.count} deal{stats.count > 1 ? "s" : ""}
                          </Badge>
                          {stats.value > 0 && (
                            <span className="text-[10px] text-muted-foreground">{formatDealValue(stats.value)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ContactDialog
        open={creating}
        onOpenChange={setCreating}
        contact={null}
      />
      {editing && (
        <ContactDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          contact={editing}
        />
      )}
    </div>
  );
}

function ContactDialog({
  open,
  onOpenChange,
  contact,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact: Contact | null;
}) {
  const create = useCreateContact();
  const update = useUpdateContact();
  const remove = useDeleteContact();
  const [form, setForm] = useState({
    name: contact?.name ?? "",
    company: contact?.company ?? "",
    title: contact?.title ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    notes: contact?.notes ?? "",
  });

  const submit = async () => {
    if (!form.name.trim()) return;
    if (contact) {
      await update.mutateAsync({
        id: contact.id,
        name: form.name.trim(),
        company: form.company.trim() || null,
        title: form.title.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      });
    } else {
      await create.mutateAsync({
        name: form.name.trim(),
        company: form.company.trim() || null,
        title: form.title.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          {contact && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={async () => {
                await remove.mutateAsync(contact.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!form.name.trim() || create.isPending || update.isPending}>
            {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {contact ? <><Pencil className="mr-2 h-4 w-4" /> Save</> : <><Plus className="mr-2 h-4 w-4" /> Create</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
