import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CUSTOMER_PRESETS,
  CONTACT_PRESETS,
  OPPORTUNITY_PRESETS,
  ENGAGEMENT_PRESETS,
  PHASE_PRESETS,
  DEFAULT_VOCABULARY,
  type VocabNoun,
  type Vocabulary,
} from "@/lib/vocabulary";
import { useVocabulary, useUpdateVocabulary } from "@/hooks/use-vocabulary";
import { Building2, Briefcase, Layers, RotateCcw, UserPlus, Target } from "lucide-react";

export const Route = createFileRoute("/app/settings/vocabulary")({
  component: VocabularyPage,
  head: () => ({
    meta: [
      { title: "Vocabulary · Aurora" },
      {
        name: "description",
        content: "Customize the words your workspace uses for clients, projects, and phases.",
      },
    ],
  }),
});

function VocabularyPage() {
  const vocab = useVocabulary();
  const update = useUpdateVocabulary();
  const [draft, setDraft] = useState<Vocabulary>(vocab);

  // Re-sync if the underlying query loads/changes.
  useEffect(() => {
    setDraft(vocab);
  }, [vocab]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(vocab);

  const save = async () => {
    try {
      await update.mutateAsync(draft);
      toast.success("Vocabulary updated");
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error ? e.message : "Unknown error" });
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Vocabulary</h2>
        <p className="text-sm text-muted-foreground">
          Pick the words your team uses. These labels show up everywhere — sidebar, buttons, headers.
        </p>
      </header>

      <Section
        icon={Building2}
        title="Customer"
        description="The companies or organizations you do work for. This is the anchor of every relationship."
        presets={CUSTOMER_PRESETS}
        value={draft.customer}
        onChange={(customer) => setDraft({ ...draft, customer })}
      />
      <Section
        icon={UserPlus}
        title="Contact"
        description="Individual people inside a customer — across different departments and roles."
        presets={CONTACT_PRESETS}
        value={draft.contact}
        onChange={(contact) => setDraft({ ...draft, contact })}
      />
      <Section
        icon={Target}
        title="Opportunity"
        description="Potential work you're pursuing — moves through your sales pipeline."
        presets={OPPORTUNITY_PRESETS}
        value={draft.opportunity}
        onChange={(opportunity) => setDraft({ ...draft, opportunity })}
      />
      <Section
        icon={Briefcase}
        title="Engagement"
        description="Won work you're delivering — a project, contract, matter, retainer."
        presets={ENGAGEMENT_PRESETS}
        value={draft.engagement}
        onChange={(engagement) => setDraft({ ...draft, engagement })}
      />
      <Section
        icon={Layers}
        title="Phase"
        description="The repeatable stages each engagement moves through."
        presets={PHASE_PRESETS}
        value={draft.phase}
        onChange={(phase) => setDraft({ ...draft, phase })}
      />

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-medium">Preview</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <Chip>New {draft.customer.singular.toLowerCase()}</Chip>
          <Chip>{draft.contact.plural} on this {draft.customer.singular.toLowerCase()}</Chip>
          <Chip>Open {draft.opportunity.plural.toLowerCase()}</Chip>
          <Chip>Active {draft.engagement.plural.toLowerCase()}</Chip>
          <Chip>{draft.phase.singular}: Discovery</Chip>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDraft(DEFAULT_VOCABULARY)}
          disabled={JSON.stringify(draft) === JSON.stringify(DEFAULT_VOCABULARY)}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to defaults
        </Button>
        <Button onClick={save} disabled={!dirty || update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  presets,
  value,
  onChange,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  presets: VocabNoun[];
  value: VocabNoun;
  onChange: (v: VocabNoun) => void;
}) {
  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md border bg-muted/30 p-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = p.singular === value.singular && p.plural === value.plural;
          return (
            <button
              key={p.singular}
              type="button"
              onClick={() => onChange(p)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.singular} / {p.plural}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Singular</Label>
          <Input
            value={value.singular}
            onChange={(e) => onChange({ ...value, singular: e.target.value })}
            placeholder="e.g. Client"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Plural</Label>
          <Input
            value={value.plural}
            onChange={(e) => onChange({ ...value, plural: e.target.value })}
            placeholder="e.g. Clients"
          />
        </div>
      </div>
    </Card>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs">{children}</span>
  );
}
