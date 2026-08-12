import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Paperclip, FileSignature } from "lucide-react";
import { getClientDocuments } from "@/lib/clients-mission.functions";

const iconFor = (kind: string) => {
  switch (kind) {
    case "contract": return <FileSignature className="h-4 w-4" />;
    case "proposal": return <Sparkles className="h-4 w-4" />;
    case "attachment": return <Paperclip className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

export function DocumentsTab({ accountId }: { accountId: string }) {
  const fn = useServerFn(getClientDocuments);
  const { data, isLoading } = useQuery({
    queryKey: ["mc-docs", accountId],
    queryFn: () => fn({ data: { accountId } }),
    staleTime: 30_000,
  });

  if (isLoading) return <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>;
  const docs = data?.docs ?? [];

  if (docs.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">No documents yet — contracts, proposals, and uploads will appear here.</Card>;
  }

  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-4 py-2">Title</th>
            <th className="text-left font-medium px-4 py-2">Kind</th>
            <th className="text-left font-medium px-4 py-2">Status</th>
            <th className="text-left font-medium px-4 py-2">Project</th>
            <th className="text-left font-medium px-4 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={`${d.kind}-${d.id}`} className="border-t border-border hover:bg-muted/30">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  {iconFor(d.kind)}
                  <span className="font-medium truncate">{d.title}</span>
                  {d.ai_generated && <Badge variant="outline" className="text-[10px]">AI</Badge>}
                  {d.version && <Badge variant="outline" className="text-[10px]">v{d.version}</Badge>}
                </div>
              </td>
              <td className="px-4 py-3 capitalize text-muted-foreground">{d.kind.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">{d.status ? <Badge variant="secondary" className="capitalize text-[10px]">{d.status.replace(/_/g, " ")}</Badge> : "—"}</td>
              <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{d.project_name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
