import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Star } from "lucide-react";

type Contact = {
  id: string;
  role: string;
  is_primary: boolean;
  department: string | null;
  contact: { id: string; name?: string | null; email?: string | null; phone?: string | null; title?: string | null } | null;
};

export function ContactsTab({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">No contacts linked yet.</Card>;
  }
  return (
    <Card className="p-4">
      <ul className="divide-y divide-border">
        {contacts.map((c) => (
          <li key={c.id} className="py-3 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{c.contact?.name ?? "—"}</span>
                {c.is_primary && <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3" /> Primary</Badge>}
                {c.role && c.role !== "primary" && <Badge variant="outline">{c.role.replace(/_/g, " ")}</Badge>}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {[c.contact?.title, c.department].filter(Boolean).join(" · ") || "—"}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                {c.contact?.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {c.contact.email}</span>}
                {c.contact?.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {c.contact.phone}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
