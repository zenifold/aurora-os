import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  listClientAccounts,
  linkFolderToClient,
  createClientIntake,
} from "@/lib/clients.functions";
import { Building2, Plus } from "lucide-react";

export function LinkFolderToClientDialog({
  open,
  onOpenChange,
  workspaceId,
  folderId,
  defaultName,
  defaultEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  folderId: string;
  defaultName?: string | null;
  defaultEmail?: string | null;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listClientAccounts);
  const linkFn = useServerFn(linkFolderToClient);
  const createFn = useServerFn(createClientIntake);

  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState(defaultName ?? "");
  const [newEmail, setNewEmail] = useState(defaultEmail ?? "");

  const { data: accounts = [] } = useQuery({
    queryKey: ["client-accounts", workspaceId],
    queryFn: () => listFn({ data: { workspace_id: workspaceId } }),
    enabled: open && !!workspaceId,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts.slice(0, 50);
    return accounts.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 50);
  }, [accounts, query]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["folders"] });
    qc.invalidateQueries({ queryKey: ["folder"] });
    qc.invalidateQueries({ queryKey: ["client-accounts"] });
  };

  const link = useMutation({
    mutationFn: (clientId: string) =>
      linkFn({ data: { folder_id: folderId, client_account_id: clientId } }),
    onSuccess: () => {
      toast.success("Folder linked to client");
      invalidate();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAndLink = useMutation({
    mutationFn: async () => {
      const result = await createFn({
        data: {
          workspace_id: workspaceId,
          intake_mode: "account_first",
          name: newName.trim(),
          billing_email: newEmail.trim() || null,
        },
      });
      const id = (result as { account: { id: string } }).account.id;
      await linkFn({ data: { folder_id: folderId, client_account_id: id } });
      return id;
    },
    onSuccess: () => {
      toast.success("Client created and linked");
      invalidate();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link folder to a client</DialogTitle>
          <DialogDescription>
            Pick an existing CRM client or create a new one. The folder becomes
            the client's delivery workspace.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="existing">
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1">
              Existing client
            </TabsTrigger>
            <TabsTrigger value="new" className="flex-1">
              Create new
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="mt-3 space-y-3">
            <Input
              placeholder="Search clients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="max-h-80 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  {accounts.length === 0
                    ? "No clients yet. Create one in the next tab."
                    : "No matches."}
                </p>
              ) : (
                filtered.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => link.mutate(a.id)}
                    disabled={link.isPending}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{a.name}</div>
                        {a.industry && (
                          <div className="text-xs text-muted-foreground truncate">
                            {a.industry}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {a.status}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="new" className="mt-3 space-y-3">
            <div>
              <Label>Client name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Acme Co."
              />
            </div>
            <div>
              <Label>Billing email (optional)</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="ap@acme.com"
              />
            </div>
            <Button
              onClick={() => createAndLink.mutate()}
              disabled={!newName.trim() || createAndLink.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" /> Create client and link
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
