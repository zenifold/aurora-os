import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, Wrench, Rocket, Users, FileText, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createInternalContainer } from "@/lib/containers.functions";

import { useWorkspaceStore } from "@/stores/workspace-store";

type Template = {
  id: string;
  name: string;
  defaultName: string;
  description: string;
  icon: LucideIcon;
  folders: string[];
};

const TEMPLATES: Template[] = [
  { id: "blank", name: "Blank", defaultName: "Space", description: "Start from scratch.", icon: Sparkles, folders: [] },
  { id: "marketing", name: "Marketing", defaultName: "Marketing", description: "Campaigns, content, and assets.", icon: Megaphone, folders: ["Campaigns", "Content", "Assets"] },
  { id: "operations", name: "Operations", defaultName: "Operations", description: "SOPs, vendors, and meetings.", icon: Wrench, folders: ["SOPs", "Vendors", "Meetings"] },
  { id: "product", name: "Product", defaultName: "Product", description: "Roadmap, specs, and research.", icon: Rocket, folders: ["Roadmap", "Specs", "Research"] },
  { id: "team", name: "Team", defaultName: "Team", description: "Notes, resources, and wiki.", icon: Users, folders: ["Notes", "Resources", "Wiki"] },
  { id: "docs", name: "Docs", defaultName: "Docs", description: "A simple knowledge base.", icon: FileText, folders: ["Guides", "References"] },
];

export function NewSpaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const createFn = useServerFn(createInternalContainer);
  const [templateId, setTemplateId] = useState("blank");
  const [name, setName] = useState("Space");

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  const pickTemplate = (t: Template) => {
    setTemplateId(t.id);
    if (!name || TEMPLATES.some((x) => x.defaultName === name)) {
      setName(t.defaultName);
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error("No workspace");
      const trimmed = name.trim() || template.defaultName;
      const space = await createFn({ data: { workspace_id: ws.id, name: trimmed } });
      return space;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["containers", ws?.id] });
      toast.success("Space created");
      onOpenChange(false);
      setTemplateId("blank");
      setName("Space");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>New Space</DialogTitle>
          <DialogDescription>Pick a template to seed your space, or start blank.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            const active = t.id === templateId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="space-name">Name</Label>
          <Input
            id="space-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={template.defaultName}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Creating…" : "Create Space"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
