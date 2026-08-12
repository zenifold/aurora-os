import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFolders } from "@/hooks/use-folders";

export interface MoveTarget {
  folder_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Legacy shape — division_id is ignored. */
  current?: { folder_id: string | null; division_id?: string } | null;
  onConfirm: (target: MoveTarget) => Promise<void> | void;
}

/** Lightweight stand-in for the legacy MoveToFolderDialog after divisions were retired. */
export function MoveToFolderDialog({ open, onOpenChange, title = "Move", current, onConfirm }: Props) {
  const { data: folders = [] } = useFolders();
  const [folderId, setFolderId] = useState<string>(current?.folder_id ?? "__root__");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFolderId(current?.folder_id ?? "__root__");
  }, [current?.folder_id, open]);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm({ folder_id: folderId === "__root__" ? null : folderId });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Folder</label>
          <Select value={folderId} onValueChange={setFolderId}>
            <SelectTrigger><SelectValue placeholder="Pick a folder" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">No folder (root)</SelectItem>
              {folders.filter((f) => !f.is_archived).map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
