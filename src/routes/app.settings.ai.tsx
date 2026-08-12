import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";
import { confirmDialog } from "@/lib/dialogs";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { generateAgentSpec } from "@/server/agent-generator.functions";
import {
  useAiAgents,
  useUpsertAgent,
  useDeleteAgent,
  useWorkspaceAiKey,
  useSetWorkspaceAiKey,
  useOpenRouterModels,
  type AiAgent,
} from "@/hooks/use-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Sparkles, Plus, Trash2, KeyRound, ExternalLink, Bot, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/settings/ai")({
  component: () => (
    <RoleGuard min="manager">
      <AiSettingsPage />
    </RoleGuard>
  ),
});

function AiSettingsPage() {
  const { data: agents = [] } = useAiAgents();
  const { data: keyRow } = useWorkspaceAiKey();
  const setKey = useSetWorkspaceAiKey();
  const remove = useDeleteAgent();

  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [editing, setEditing] = useState<AiAgent | null>(null);
  const [creating, setCreating] = useState(false);

  const hasKey = !!keyRow?.openrouter_api_key;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" /> AI agents
          </h1>
          <p className="text-sm text-muted-foreground">
            Create virtual team members that can be assigned to tasks. Powered by OpenRouter.
          </p>
        </div>
      </div>

      {/* OpenRouter key card */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-aura-gradient-subtle p-2">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-medium">OpenRouter API key</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {hasKey ? (
                  <>
                    Configured · <span className="font-mono">{maskKey(keyRow!.openrouter_api_key!)}</span>
                  </>
                ) : (
                  <>No key set. AI agents won't run until you add one.</>
                )}
              </p>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Get an OpenRouter key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            {hasKey && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: "Remove OpenRouter key?",
                    description: "Agents in this workspace won't be able to run until a new key is added.",
                    confirmLabel: "Remove",
                    tone: "destructive",
                  });
                  if (!ok) return;
                  await setKey.mutateAsync(null);
                  toast.success("Key removed");
                }}
              >
                Remove
              </Button>
            )}
            <Button size="sm" onClick={() => setShowKeyDialog(true)}>
              {hasKey ? "Update key" : "Add key"}
            </Button>
          </div>
        </div>
      </div>

      {/* Agents list */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-medium">Agents</h2>
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          className="bg-aura-gradient text-primary-foreground hover:opacity-90"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New agent
        </Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {agents.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No agents yet</p>
            <p className="text-xs text-muted-foreground">
              Create your first AI teammate to assign tasks to.
            </p>
          </div>
        )}
        {agents.map((a) => (
          <div
            key={a.id}
            className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient-subtle text-xl">
                {a.avatar_emoji ?? "🤖"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{a.name}</p>
                  {!a.is_active && <Badge variant="secondary">Disabled</Badge>}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {a.description || "No description"}
                </p>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">{a.model}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
              <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: "Delete agent?",
                    description: `"${a.name}" will no longer be assignable to tasks.`,
                    confirmLabel: "Delete",
                    tone: "destructive",
                  });
                  if (ok) remove.mutate(a.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <KeyDialog
        open={showKeyDialog}
        onOpenChange={setShowKeyDialog}
        existing={keyRow?.openrouter_api_key ?? null}
        onSave={async (val) => {
          await setKey.mutateAsync(val);
          toast.success("OpenRouter key saved");
          setShowKeyDialog(false);
        }}
      />

      <AgentDialog
        open={creating || !!editing}
        agent={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AuraMemoryCard />
    </div>
  );
}

function maskKey(k: string) {
  if (k.length < 12) return "••••";
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

function KeyDialog({
  open,
  onOpenChange,
  existing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: string | null;
  onSave: (v: string) => Promise<void>;
}) {
  const [val, setVal] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setVal("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>OpenRouter API key</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Get a key at{" "}
            <a
              className="text-primary hover:underline"
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
            >
              openrouter.ai/keys
            </a>
            . Stored encrypted at-rest, only visible to workspace owners.
          </p>
          <Input
            placeholder={existing ? "Enter new key to replace…" : "sk-or-v1-…"}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            type="password"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!val.trim()}
            onClick={() => onSave(val.trim())}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentDialog({
  open,
  agent,
  onClose,
}: {
  open: boolean;
  agent: AiAgent | null;
  onClose: () => void;
}) {
  const upsert = useUpsertAgent();
  const generateAgentFn = useServerFn(generateAgentSpec);
  const workspaceId = useWorkspaceStore((s) => s.current?.id);
  const { data: keyRow } = useWorkspaceAiKey();
  const hasKey = !!keyRow?.openrouter_api_key;

  const [name, setName] = useState(agent?.name ?? "");
  const [emoji, setEmoji] = useState(agent?.avatar_emoji ?? "🤖");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(
    agent?.system_prompt ?? "You are a helpful AI assistant working on tasks.",
  );
  const [model, setModel] = useState(agent?.model ?? "xiaomi/mimo-v2-flash");
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(agent?.max_tokens ?? 2000);

  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const reset = () => {
    setName(agent?.name ?? "");
    setEmoji(agent?.avatar_emoji ?? "🤖");
    setDescription(agent?.description ?? "");
    setSystemPrompt(
      agent?.system_prompt ?? "You are a helpful AI assistant working on tasks.",
    );
    setModel(agent?.model ?? "xiaomi/mimo-v2-flash");
    setTemperature(agent?.temperature ?? 0.7);
    setMaxTokens(agent?.max_tokens ?? 2000);
    setAiPrompt("");
  };

  const handleGenerate = async () => {
    if (!workspaceId || !aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const spec = await generateAgentFn({
        data: { workspace_id: workspaceId, prompt: aiPrompt.trim() },
      });
      setName(spec.name);
      setEmoji(spec.avatar_emoji);
      setDescription(spec.description);
      setSystemPrompt(spec.system_prompt);
      setModel(spec.model);
      setTemperature(spec.temperature);
      setMaxTokens(spec.max_tokens);
      toast.success("Agent drafted — tweak and save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate agent");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
        } else {
          reset();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit agent" : "New AI agent"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!agent && (
            <div className="rounded-xl border border-primary/30 bg-aura-gradient-subtle p-3">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Describe your agent
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && aiPrompt.trim() && hasKey) {
                      e.preventDefault();
                      void handleGenerate();
                    }
                  }}
                  placeholder="A senior copywriter who drafts blog intros…"
                  className="flex-1"
                  disabled={generating}
                />
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={!aiPrompt.trim() || generating || !hasKey}
                  className="bg-aura-gradient text-primary-foreground hover:opacity-90"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate
                    </>
                  )}
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {hasKey
                  ? "AI will draft the name, prompt, and recommended model — you can edit everything below."
                  : "Add an OpenRouter key first to enable AI generation."}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <div>
              <Label>Emoji</Label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                className="mt-1.5 w-16 text-center text-lg"
              />
            </div>
            <div className="flex-1">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Content Writer"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Drafts blog posts, emails, and copy"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>System prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              className="mt-1.5 font-mono text-xs"
              placeholder="You are a senior product manager. Write concise, actionable user stories…"
            />
          </div>

          <div>
            <Label>Model</Label>
            <ModelPicker value={model} onChange={setModel} />
            <p className="mt-1 text-xs text-muted-foreground">
              Live catalog from{" "}
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                openrouter.ai/models
              </a>
              .
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Temperature ({temperature.toFixed(1)})</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="mt-3 w-full"
              />
            </div>
            <div>
              <Label>Max tokens</Label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2000)}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || upsert.isPending}
            onClick={async () => {
              await upsert.mutateAsync({
                id: agent?.id,
                name: name.trim(),
                avatar_emoji: emoji,
                description,
                system_prompt: systemPrompt,
                model,
                temperature,
                max_tokens: maxTokens,
              });
              toast.success(agent ? "Agent updated" : "Agent created");
              onClose();
            }}
            className="bg-aura-gradient text-primary-foreground hover:opacity-90"
          >
            {agent ? "Save" : "Create agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data, isLoading, error } = useOpenRouterModels();
  const [open, setOpen] = useState(false);
  const models = data?.models ?? [];
  const selected = models.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="mt-1.5 w-full justify-between font-mono text-xs"
        >
          <span className="truncate">
            {isLoading ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading models…
              </span>
            ) : selected ? (
              <>
                <span className="font-sans">{selected.name}</span>
                <span className="ml-2 text-muted-foreground">{selected.id}</span>
              </>
            ) : (
              value || "Select a model…"
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const m = models.find((x) => x.id === itemValue);
            const hay = `${itemValue} ${m?.name ?? ""}`.toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search models…" />
          <CommandList>
            {error || data?.error ? (
              <CommandEmpty>Failed to load models. {data?.error}</CommandEmpty>
            ) : (
              <CommandEmpty>No models found.</CommandEmpty>
            )}
            <CommandGroup>
              {models.map((m) => {
                const promptPrice = m.pricing ? Number(m.pricing.prompt) * 1_000_000 : null;
                return (
                  <CommandItem
                    key={m.id}
                    value={m.id}
                    onSelect={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className="flex items-start gap-2"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        value === m.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm">{m.name}</span>
                        {promptPrice !== null && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            ${promptPrice.toFixed(2)}/M
                          </span>
                        )}
                      </div>
                      <div className="truncate font-mono text-[10px] text-muted-foreground">
                        {m.id}
                        {m.context_length ? ` · ${(m.context_length / 1000).toFixed(0)}k ctx` : ""}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Workspace memory — pinned facts Aura always applies
// ─────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAuraMemory,
  upsertAuraMemory,
  deleteAuraMemory,
} from "@/lib/aura-memory.functions";
import { Pin, BookMarked } from "lucide-react";

const MEM_KINDS = [
  { value: "fact", label: "Fact", hint: "Concrete info Aura should know (clients, contracts, prices)" },
  { value: "preference", label: "Preference", hint: "How you want things done" },
  { value: "style", label: "Style/voice", hint: "Tone, brand voice, formatting" },
  { value: "other", label: "Other", hint: "" },
] as const;

function AuraMemoryCard() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  const list = useServerFn(listAuraMemory);
  const upsert = useServerFn(upsertAuraMemory);
  const remove = useServerFn(deleteAuraMemory);

  const { data } = useQuery({
    queryKey: ["aura-memory", ws?.id],
    queryFn: () => list({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id,
  });
  const rows = data?.ok ? data.memory : [];

  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<typeof MEM_KINDS[number]["value"]>("fact");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const save = useMutation({
    mutationFn: async (vars: { id?: string; content: string; kind: typeof MEM_KINDS[number]["value"]; pinned?: boolean }) =>
      upsert({ data: { workspace_id: ws!.id, ...vars } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["aura-memory", ws?.id] });
      toast.success("Memory saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aura-memory", ws?.id] }),
  });

  const togglePin = (id: string, pinned: boolean, content: string, kind: typeof MEM_KINDS[number]["value"]) =>
    save.mutate({ id, content, kind, pinned: !pinned });

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookMarked className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Workspace memory</h2>
          <p className="text-xs text-muted-foreground">
            Pinned facts Aura includes in every answer — clients you serve, brand voice,
            contract rules, conventions. Keep entries short and specific.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="rounded-lg border bg-background/60 p-3">
          <div className="mb-2 flex flex-wrap gap-1">
            {MEM_KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition",
                  kind === k.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent",
                )}
                title={k.hint}
              >
                {k.label}
              </button>
            ))}
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. We work primarily with B2B SaaS clients in EMEA. Always use British English in client-facing copy."
            rows={2}
            className="resize-none text-sm"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{draft.length}/2000</span>
            <Button
              size="sm"
              disabled={!draft.trim() || save.isPending}
              onClick={() => {
                save.mutate(
                  { content: draft.trim(), kind, pinned: true },
                  { onSuccess: () => setDraft("") },
                );
              }}
            >
              <Plus className="mr-1 h-3 w-3" /> Add to memory
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            No memory pinned yet. Add facts above to teach Aura about your workspace.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((m) => {
              const isEditing = editingId === m.id;
              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex items-start gap-2 rounded-md border bg-background/60 px-3 py-2 text-sm",
                    !m.pinned && "opacity-60",
                  )}
                >
                  <button
                    onClick={() => togglePin(m.id, m.pinned, m.content, m.kind as typeof MEM_KINDS[number]["value"])}
                    className={cn(
                      "mt-0.5 shrink-0 rounded p-0.5 transition",
                      m.pinned ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                    title={m.pinned ? "Pinned — click to unpin" : "Unpinned — click to pin"}
                  >
                    <Pin className={cn("h-3.5 w-3.5", m.pinned && "fill-current")} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal capitalize">
                        {m.kind}
                      </Badge>
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                        autoFocus
                      />
                    ) : (
                      <p className="break-words text-sm">{m.content}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            save.mutate(
                              {
                                id: m.id,
                                content: editingText.trim() || m.content,
                                kind: m.kind as typeof MEM_KINDS[number]["value"],
                                pinned: m.pinned,
                              },
                              { onSuccess: () => setEditingId(null) },
                            );
                          }}
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingId(m.id);
                            setEditingText(m.content);
                          }}
                          title="Edit"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            void confirmDialog({
                              title: "Remove memory?",
                              description: "Aura will stop using this in answers.",
                              confirmLabel: "Remove", tone: "destructive",
                            }).then((ok) => ok && del.mutate(m.id));
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
