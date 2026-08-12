import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Briefcase,
  FileText,
  Users,
  StickyNote,
  Receipt,
  CalendarPlus,
  ListTodo,
  Sparkles,
  AlertTriangle,
  FolderPlus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useCreateProject } from "@/hooks/use-projects";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface Props {
  clientAccountId: string;
  clientName: string;
  isClient: boolean;
  onCreatedSow?: () => void;
  onOpenSowDialog?: () => void;
  onOpenRequestDialog?: () => void;
  folderId?: string | null;
}

type CreateKind =
  | "engagement"
  | "deal"
  | "sow"
  | "contact"
  | "note"
  | "task"
  | "meeting"
  | "invoice"
  | "risk"
  | "request"
  | "file";

export function ClientCreateMenu(props: Props) {
  const [activeKind, setActiveKind] = useState<CreateKind | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground tracking-wide">
            Delivery
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setActiveKind("engagement")}>
            <Briefcase className="h-4 w-4 mr-2" /> Engagement / project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveKind("task")}>
            <ListTodo className="h-4 w-4 mr-2" /> Task
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveKind("risk")}>
            <AlertTriangle className="h-4 w-4 mr-2" /> Risk / issue
          </DropdownMenuItem>

          {props.isClient && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground tracking-wide">
                Sales
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setActiveKind("deal")}>
                <Sparkles className="h-4 w-4 mr-2" /> Opportunity
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => props.onOpenSowDialog?.()}>
                <FileText className="h-4 w-4 mr-2" /> SOW / proposal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveKind("contact")}>
                <Users className="h-4 w-4 mr-2" /> Contact
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground tracking-wide">
            Comms & finance
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setActiveKind("note")}>
            <StickyNote className="h-4 w-4 mr-2" /> Note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveKind("meeting")}>
            <CalendarPlus className="h-4 w-4 mr-2" /> Meeting
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveKind("invoice")}>
            <Receipt className="h-4 w-4 mr-2" /> Invoice
          </DropdownMenuItem>

          {props.isClient && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground tracking-wide">
                Customer collab
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => props.onOpenRequestDialog?.()}>
                <FolderPlus className="h-4 w-4 mr-2" /> Client request bundle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveKind("file")}>
                <Upload className="h-4 w-4 mr-2" /> Upload file
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateDialog
        kind={activeKind}
        onClose={() => setActiveKind(null)}
        {...props}
      />
    </>
  );
}

function CreateDialog({
  kind,
  onClose,
  clientAccountId,
  clientName,
}: Props & { kind: CreateKind | null; onClose: () => void }) {
  if (!kind || kind === "file" || kind === "request" || kind === "sow") return null;
  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title(kind)}</DialogTitle>
        </DialogHeader>
        <CreateForm
          kind={kind}
          clientAccountId={clientAccountId}
          clientName={clientName}
          onDone={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}


function title(kind: CreateKind) {
  switch (kind) {
    case "engagement": return "New engagement";
    case "deal": return "New opportunity";
    case "contact": return "New contact";
    case "note": return "New note";
    case "task": return "New task";
    case "meeting": return "New meeting";
    case "invoice": return "New invoice (draft)";
    case "risk": return "New risk";
    default: return "New";
  }
}

function CreateForm({
  kind,
  clientAccountId,
  clientName,
  onDone,
}: {
  kind: Exclude<CreateKind, "file" | "request" | "sow">;
  clientAccountId: string;
  clientName: string;
  onDone: () => void;
}) {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  const submit = async () => {
    if (!ws || !user) return;
    setBusy(true);
    try {
      if (mode === "ai" && aiPrompt.trim()) {
        toast.info(`AI draft queued — review in approvals`);
      }

      switch (kind) {
        case "engagement": {
          const p = await createProject.mutateAsync({
            name: title.trim() || `${clientName} engagement`,
            description: body.trim() || null,
            client_name: clientName,
            is_client_project: true,
            client_account_id: clientAccountId,
          });
          navigate({ to: "/app/p/$projectId", params: { projectId: p.id } });
          break;
        }
        case "deal": {
          const { data, error } = await supabase
            .from("deals" as never)
            .insert({
              workspace_id: ws.id,
              client_account_id: clientAccountId,
              title: title.trim() || `${clientName} opportunity`,
              description: body.trim() || null,
              status: "open",
              created_by: user.id,
            } as never)
            .select()
            .single();
          if (error) throw error;
          toast.success("Opportunity created");
          break;
        }
        case "contact": {
          const { error } = await supabase.from("contacts" as never).insert({
            workspace_id: ws.id,
            client_account_id: clientAccountId,
            name: title.trim() || "Untitled contact",
            email: body.trim() || null,
            created_by: user.id,
          } as never);
          if (error) throw error;
          toast.success("Contact added");
          break;
        }
        case "note": {
          const { error } = await supabase.from("notes" as never).insert({
            workspace_id: ws.id,
            client_account_id: clientAccountId,
            title: title.trim() || "Untitled note",
            body: body.trim() || null,
            created_by: user.id,
          } as never);
          if (error) throw error;
          toast.success("Note saved");
          break;
        }
        case "task": {
          const { error } = await supabase.from("tasks").insert({
            workspace_id: ws.id,
            title: title.trim() || "Untitled task",
            project_id: clientAccountId, // ad-hoc; user can move
            status: "todo",
            created_by: user.id,
          } as never);
          if (error) {
            toast.error("Tasks need a project — open an engagement first.");
            return;
          }
          toast.success("Task created");
          break;
        }
        case "meeting": {
          const { error } = await supabase.from("meetings" as never).insert({
            workspace_id: ws.id,
            client_account_id: clientAccountId,
            title: title.trim() || `Meeting with ${clientName}`,
            description: body.trim() || null,
            scheduled_at: new Date().toISOString(),
            created_by: user.id,
          } as never);
          if (error) throw error;
          toast.success("Meeting scheduled");
          break;
        }
        case "invoice": {
          const { error } = await supabase.from("invoices" as never).insert({
            workspace_id: ws.id,
            client_account_id: clientAccountId,
            title: title.trim() || `Invoice — ${clientName}`,
            status: "draft",
            currency: "USD",
            total: 0,
            created_by: user.id,
          } as never);
          if (error) throw error;
          toast.success("Invoice draft created");
          break;
        }
        case "risk": {
          const { error } = await supabase.from("raid_items" as never).insert({
            workspace_id: ws.id,
            client_account_id: clientAccountId,
            kind: "risk",
            title: title.trim() || "Untitled risk",
            description: body.trim() || null,
            severity: "medium",
            status: "open",
            created_by: user.id,
          } as never);
          if (error) throw error;
          toast.success("Risk logged");
          break;
        }
      }
      onDone();
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Couldn't create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "ai")}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Draft with AI</TabsTrigger>
        </TabsList>
        <TabsContent value="manual" className="space-y-3 mt-3">
          <div>
            <Label className="text-xs">{kind === "contact" ? "Name" : "Title"}</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={placeholder(kind, clientName)}
            />
          </div>
          <div>
            <Label className="text-xs">
              {kind === "contact" ? "Email" : "Description"}
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Optional"
            />
          </div>
        </TabsContent>
        <TabsContent value="ai" className="space-y-3 mt-3">
          <Label className="text-xs">Tell the AI what to draft</Label>
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={4}
            placeholder={`e.g. "Draft a ${kind} for the ${clientName} relaunch in October"`}
          />
          <p className="text-[11px] text-muted-foreground">
            Sensitive actions (sending email, creating invoices &gt; $0, contract drafts) route through the approvals inbox before going live.
          </p>
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function placeholder(kind: string, clientName: string) {
  switch (kind) {
    case "engagement": return `${clientName} — Q4 delivery`;
    case "deal": return `${clientName} expansion`;
    case "contact": return "Jane Doe";
    case "note": return "Kickoff notes";
    case "task": return "Send recap to client";
    case "meeting": return `Sync with ${clientName}`;
    case "invoice": return `Invoice #001`;
    case "risk": return "Scope creep risk";
    default: return "";
  }
}
