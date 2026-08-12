import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Globe,
  Linkedin,
  Phone,
  Calendar,
  UserPlus,
  Building2,
  Target,
  Settings2,
  Loader2,
  Plus,
  X,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  createClientIntake,
  listDealStages,
  LEAD_SOURCES,
} from "@/lib/clients.functions";
import { DEAL_CONTACT_ROLES, DEPARTMENT_PRESETS } from "@/lib/vocabulary";
import { cn } from "@/lib/utils";

type Tier = "standard" | "premium" | "strategic";
type IntakeMode = "account_first" | "contact_first";

const STEPS = [
  { id: "source", label: "How we met", icon: Sparkles },
  { id: "company", label: "Company", icon: Building2 },
  { id: "stakeholders", label: "Stakeholders", icon: UserPlus },
  { id: "opportunity", label: "Opportunity", icon: Target },
  { id: "review", label: "Review", icon: Check },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  customerLabel: string;
  contactLabel?: string;
  opportunityLabel?: string;
  onCreated?: (accountId: string) => void;
}

const SOURCE_ICON: Record<string, typeof Globe> = {
  cold_outreach: Phone,
  conference_event: Calendar,
  linkedin: Linkedin,
  website_form: Globe,
  referral: UserPlus,
  inbound_email: Sparkles,
  partner: Building2,
  existing_customer: Check,
  other: Sparkles,
};

const SOURCE_PLACEHOLDER: Record<string, string> = {
  cold_outreach: "Campaign name or call list",
  conference_event: "Event name (e.g. SaaStr 2026)",
  linkedin: "Profile URL or campaign",
  website_form: "Page they came from",
  referral: "Who referred them",
  inbound_email: "Subject or campaign",
  partner: "Partner / channel name",
  existing_customer: "Which account expanded",
  other: "Add context…",
};

type DraftContact = {
  id: string; // local-only
  name: string;
  title: string;
  email: string;
  phone: string;
  department: string;
  deal_role: string;
  is_primary: boolean;
  link_to_deal: boolean;
};

function emptyContact(): DraftContact {
  return {
    id: crypto.randomUUID(),
    name: "",
    title: "",
    email: "",
    phone: "",
    department: "",
    deal_role: "champion",
    is_primary: false,
    link_to_deal: true,
  };
}

export function NewClientWizard({
  open,
  onOpenChange,
  workspaceId,
  customerLabel,
  contactLabel = "Contact",
  opportunityLabel = "Opportunity",
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const intake = useServerFn(createClientIntake);
  const stagesFn = useServerFn(listDealStages);

  const { data: stages = [] } = useQuery({
    queryKey: ["deal-stages", workspaceId],
    queryFn: () => stagesFn({ data: { workspace_id: workspaceId } }),
    enabled: open && !!workspaceId,
  });

  const openStages = useMemo(
    () => stages.filter((s) => s.stage_type === "open"),
    [stages],
  );
  const firstOpenStageId = openStages[0]?.id ?? "";

  const [step, setStep] = useState<StepId>("source");
  const [submitting, setSubmitting] = useState(false);

  // Entry mode
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("account_first");

  // Source
  const [leadSource, setLeadSource] = useState<string>("cold_outreach");
  const [sourceDetail, setSourceDetail] = useState("");
  const [firstTouch, setFirstTouch] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Company
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [website, setWebsite] = useState("");
  const [tier, setTier] = useState<Tier>("standard");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Stakeholders (multi)
  const [contacts, setContacts] = useState<DraftContact[]>([
    { ...emptyContact(), is_primary: true },
  ]);

  // Opportunity
  const [dealEnabled, setDealEnabled] = useState(true);
  const [dealTitle, setDealTitle] = useState("");
  const [dealStageId, setDealStageId] = useState<string>("");
  const [dealValue, setDealValue] = useState<string>("");
  const [dealClose, setDealClose] = useState<string>("");
  const [dealDescription, setDealDescription] = useState("");

  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!dealStageId && firstOpenStageId) setDealStageId(firstOpenStageId);
  }, [firstOpenStageId, dealStageId]);

  useEffect(() => {
    if (name && !dealTitle) setDealTitle(`${name} — initial ${opportunityLabel.toLowerCase()}`);
  }, [name, dealTitle, opportunityLabel]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("source");
        setIntakeMode("account_first");
        setLeadSource("cold_outreach");
        setSourceDetail("");
        setFirstTouch(new Date().toISOString().slice(0, 10));
        setName("");
        setLegalName("");
        setIndustry("");
        setSize("");
        setWebsite("");
        setTier("standard");
        setTags([]);
        setTagInput("");
        setContacts([{ ...emptyContact(), is_primary: true }]);
        setDealEnabled(true);
        setDealTitle("");
        setDealValue("");
        setDealClose("");
        setDealDescription("");
        setNotes("");
      }, 200);
    }
  }, [open]);

  // Step ordering — in contact-first mode, swap company/stakeholders so the
  // person you actually met is captured first.
  const orderedSteps = useMemo<readonly StepId[]>(() => {
    if (intakeMode === "contact_first") {
      return ["source", "stakeholders", "company", "opportunity", "review"];
    }
    return ["source", "company", "stakeholders", "opportunity", "review"];
  }, [intakeMode]);

  const stepIndex = orderedSteps.indexOf(step);
  const isLast = step === "review";
  const isFirst = stepIndex === 0;

  function updateContact(id: string, patch: Partial<DraftContact>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function setPrimary(id: string) {
    setContacts((prev) => prev.map((c) => ({ ...c, is_primary: c.id === id })));
  }

  function removeContact(id: string) {
    setContacts((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((c) => c.id !== id);
      if (!next.some((c) => c.is_primary)) next[0].is_primary = true;
      return next;
    });
  }

  function addStakeholder() {
    if (contacts.length >= 10) {
      toast.error("Max 10 stakeholders during intake — add more later");
      return;
    }
    setContacts((prev) => [...prev, emptyContact()]);
  }

  function next() {
    if (step === "company" && !name.trim()) {
      toast.error(`${customerLabel} name is required`);
      return;
    }
    if (step === "stakeholders") {
      const named = contacts.filter((c) => c.name.trim());
      if (intakeMode === "contact_first" && named.length === 0) {
        toast.error("Add at least one person — you said you met someone");
        return;
      }
      // Drop empty rows silently so review is clean
      if (named.length === 0) {
        // allow proceeding with zero contacts in account-first mode
      }
    }
    if (step === "opportunity" && dealEnabled) {
      if (!dealTitle.trim()) return toast.error(`${opportunityLabel} title is required`);
      if (!dealStageId) return toast.error("Pick a sales stage");
    }
    const i = stepIndex;
    if (i < orderedSteps.length - 1) setStep(orderedSteps[i + 1]);
  }

  function back() {
    const i = stepIndex;
    if (i > 0) setStep(orderedSteps[i - 1]);
  }

  function addTag() {
    const v = tagInput.trim();
    if (!v || tags.includes(v) || tags.length >= 20) return;
    setTags([...tags, v]);
    setTagInput("");
  }

  const create = useMutation({
    mutationFn: async () => {
      setSubmitting(true);
      const cleanContacts = contacts
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          title: c.title.trim() || null,
          email: c.email.trim() || null,
          phone: c.phone.trim() || null,
          department: c.department.trim() || null,
          account_role: "day_to_day",
          deal_role: c.deal_role as
            | "champion"
            | "decision_maker"
            | "influencer"
            | "end_user"
            | "blocker"
            | "legal"
            | "finance"
            | "technical"
            | "other",
          is_primary: c.is_primary,
          link_to_deal: c.link_to_deal,
        }));

      return intake({
        data: {
          workspace_id: workspaceId,
          intake_mode: intakeMode,
          name: name.trim() || (cleanContacts[0]?.name ?? "Untitled"),
          legal_name: legalName.trim() || null,
          industry: industry.trim() || null,
          size: size.trim() || null,
          website: website.trim() || null,
          tier,
          notes: notes.trim() || null,
          tags,
          lead_source: leadSource,
          source_detail: sourceDetail.trim() || null,
          first_touch_at: firstTouch ? new Date(firstTouch).toISOString() : null,
          contacts: cleanContacts,
          deal:
            dealEnabled && dealTitle.trim() && dealStageId
              ? {
                  title: dealTitle.trim(),
                  stage_id: dealStageId,
                  value: dealValue ? Number(dealValue) : null,
                  currency: "USD",
                  expected_close_date: dealClose || null,
                  description: dealDescription.trim() || null,
                }
              : null,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${customerLabel} created`);
      qc.invalidateQueries({ queryKey: ["client-accounts", workspaceId] });
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["divisions"] });
      onOpenChange(false);
      setSubmitting(false);
      onCreated?.(res.account.id);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSubmitting(false);
    },
  });

  const SourceIcon = SOURCE_ICON[leadSource] ?? Sparkles;
  const selectedStage = stages.find((s) => s.id === dealStageId);
  const namedContacts = contacts.filter((c) => c.name.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            New {customerLabel.toLowerCase()}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Capture how the relationship started and seed the {opportunityLabel.toLowerCase()} in one pass.{" "}
            <Link
              to="/app/settings/sales-stages"
              className="text-primary hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Customize sales stages →
            </Link>
          </DialogDescription>

          {/* Stepper */}
          <div className="flex items-center gap-1.5 pt-3">
            {orderedSteps.map((id, i) => {
              const meta = STEPS.find((s) => s.id === id)!;
              const Icon = meta.icon;
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (i <= stepIndex) setStep(id);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    active && "bg-primary text-primary-foreground",
                    done && "text-primary hover:bg-primary/10",
                    !active && !done && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                      active && "bg-primary-foreground/20",
                      done && "bg-primary/15",
                      !active && !done && "bg-muted",
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </span>
                  <span className="hidden sm:inline">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {step === "source" && (
            <div className="space-y-5">
              {/* Entry mode */}
              <div>
                <Label className="text-xs">What did you know first?</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <ModePick
                    active={intakeMode === "account_first"}
                    icon={Building2}
                    title={`${customerLabel} first`}
                    description={`You know the company — e.g. inbound form, RFP, referral to "Acme".`}
                    onClick={() => setIntakeMode("account_first")}
                  />
                  <ModePick
                    active={intakeMode === "contact_first"}
                    icon={UserPlus}
                    title="Person first"
                    description="You met someone — LinkedIn DM, conference, cold reply. Company can come later."
                    onClick={() => setIntakeMode("contact_first")}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-xs">Channel</Label>
                <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
                  Where did this relationship start? Aura uses this to suggest playbooks.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {LEAD_SOURCES.map((s) => {
                    const Icon = SOURCE_ICON[s.value] ?? Sparkles;
                    const active = leadSource === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setLeadSource(s.value)}
                        className={cn(
                          "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left text-xs transition-colors",
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                            : "hover:bg-muted/40",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="font-medium">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Context <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    placeholder={SOURCE_PLACEHOLDER[leadSource] ?? ""}
                    value={sourceDetail}
                    onChange={(e) => setSourceDetail(e.target.value)}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">First touch</Label>
                  <Input
                    type="date"
                    value={firstTouch}
                    onChange={(e) => setFirstTouch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === "company" && (
            <div className="space-y-4">
              {intakeMode === "contact_first" && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  You started with a person. Add their company now, or leave the
                  name as a placeholder and edit later.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">{customerLabel} name *</Label>
                  <Input
                    autoFocus
                    placeholder="Acme Inc."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Legal name <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    placeholder="Acme, Inc."
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Website</Label>
                  <Input
                    placeholder="https://acme.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Industry</Label>
                  <Input
                    placeholder="SaaS, Retail…"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Company size</Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a band" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1–10</SelectItem>
                      <SelectItem value="11-50">11–50</SelectItem>
                      <SelectItem value="51-200">51–200</SelectItem>
                      <SelectItem value="201-1000">201–1,000</SelectItem>
                      <SelectItem value="1001-5000">1,001–5,000</SelectItem>
                      <SelectItem value="5000+">5,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tier</Label>
                  <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="strategic">Strategic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Tags</Label>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {tags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                      >
                        {t} ✕
                      </Badge>
                    ))}
                    <Input
                      className="h-7 w-40"
                      placeholder="Add tag…"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      maxLength={40}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "stakeholders" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Stakeholders</div>
                  <div className="text-xs text-muted-foreground">
                    The people you're talking to. Mark one as primary; tag each with their
                    department and role on this {opportunityLabel.toLowerCase()}.
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={addStakeholder}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add {contactLabel.toLowerCase()}
                </Button>
              </div>

              <div className="space-y-3">
                {contacts.map((c, i) => (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-lg border p-3 space-y-3 transition-colors",
                      c.is_primary ? "border-primary/40 bg-primary/[0.03]" : "bg-card",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="text-muted-foreground">#{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => setPrimary(c.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors",
                            c.is_primary
                              ? "bg-primary text-primary-foreground"
                              : "border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Star className="h-2.5 w-2.5" />
                          {c.is_primary ? "Primary" : "Set primary"}
                        </button>
                      </div>
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeContact(c.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name</Label>
                        <Input
                          placeholder="Jane Doe"
                          value={c.name}
                          onChange={(e) => updateContact(c.id, { name: e.target.value })}
                          maxLength={120}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Title</Label>
                        <Input
                          placeholder="Head of Procurement"
                          value={c.title}
                          onChange={(e) => updateContact(c.id, { title: e.target.value })}
                          maxLength={120}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</Label>
                        <Input
                          type="email"
                          placeholder="jane@acme.com"
                          value={c.email}
                          onChange={(e) => updateContact(c.id, { email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone</Label>
                        <Input
                          placeholder="+1 555-0123"
                          value={c.phone}
                          onChange={(e) => updateContact(c.id, { phone: e.target.value })}
                          maxLength={40}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Department</Label>
                        <Select
                          value={c.department}
                          onValueChange={(v) => updateContact(c.id, { department: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pick department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENT_PRESETS.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Role on this {opportunityLabel.toLowerCase()}
                        </Label>
                        <Select
                          value={c.deal_role}
                          onValueChange={(v) => updateContact(c.id, { deal_role: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEAL_CONTACT_ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={c.link_to_deal}
                        onCheckedChange={(v) => updateContact(c.id, { link_to_deal: v })}
                      />
                      Include on the {opportunityLabel.toLowerCase()}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "opportunity" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Initial {opportunityLabel.toLowerCase()}</div>
                  <div className="text-xs text-muted-foreground">
                    Seed a deal in your pipeline at the right stage. Skip if it's too early.
                  </div>
                </div>
                <Switch checked={dealEnabled} onCheckedChange={setDealEnabled} />
              </div>
              {dealEnabled && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{opportunityLabel} title *</Label>
                    <Input
                      placeholder="Acme — Q1 platform rollout"
                      value={dealTitle}
                      onChange={(e) => setDealTitle(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Sales stage *</Label>
                      <Link
                        to="/app/settings/sales-stages"
                        className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                        onClick={() => onOpenChange(false)}
                      >
                        <Settings2 className="h-3 w-3" /> Customize
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {openStages.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Loading stages…</p>
                      ) : (
                        openStages.map((s) => {
                          const active = dealStageId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setDealStageId(s.id)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                                active
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "hover:bg-muted",
                              )}
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.name}
                              <span className="text-[10px] text-muted-foreground">
                                {s.default_probability}%
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Value (USD)</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="50000"
                        value={dealValue}
                        onChange={(e) => setDealValue(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Expected close</Label>
                      <Input
                        type="date"
                        value={dealClose}
                        onChange={(e) => setDealClose(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notes / next step</Label>
                    <Textarea
                      rows={3}
                      placeholder="What do they need? When are you following up?"
                      value={dealDescription}
                      onChange={(e) => setDealDescription(e.target.value)}
                      maxLength={2000}
                    />
                  </div>
                  {namedContacts.length > 0 && (
                    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                      <div className="font-medium mb-1">On this {opportunityLabel.toLowerCase()}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {namedContacts
                          .filter((c) => c.link_to_deal)
                          .map((c) => (
                            <Badge key={c.id} variant="secondary" className="text-[10px]">
                              {c.name}
                              {c.deal_role && (
                                <span className="ml-1 text-muted-foreground">
                                  · {DEAL_CONTACT_ROLES.find((r) => r.value === c.deal_role)?.label}
                                </span>
                              )}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-3 text-sm">
              <ReviewRow icon={SourceIcon} label="How we met">
                {LEAD_SOURCES.find((s) => s.value === leadSource)?.label}
                {sourceDetail && (
                  <span className="text-muted-foreground"> — {sourceDetail}</span>
                )}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {intakeMode === "contact_first" ? "Person first" : `${customerLabel} first`}
                </Badge>
              </ReviewRow>
              <ReviewRow icon={Building2} label={customerLabel}>
                <span className="font-medium">{name || "—"}</span>
                {industry && (
                  <span className="text-muted-foreground"> · {industry}</span>
                )}
                {size && <span className="text-muted-foreground"> · {size}</span>}
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {tier}
                </Badge>
              </ReviewRow>
              <ReviewRow icon={UserPlus} label={`${contactLabel}s (${namedContacts.length})`}>
                {namedContacts.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  <div className="space-y-1">
                    {namedContacts.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center gap-1">
                        {c.is_primary && (
                          <Star className="h-3 w-3 text-primary fill-primary" />
                        )}
                        <span className="font-medium">{c.name}</span>
                        {c.title && (
                          <span className="text-muted-foreground">· {c.title}</span>
                        )}
                        {c.department && (
                          <Badge variant="outline" className="text-[10px]">
                            {c.department}
                          </Badge>
                        )}
                        {c.link_to_deal && (
                          <span className="text-[10px] text-muted-foreground">
                            · {DEAL_CONTACT_ROLES.find((r) => r.value === c.deal_role)?.label}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ReviewRow>
              <ReviewRow icon={Target} label={opportunityLabel}>
                {dealEnabled && dealTitle ? (
                  <>
                    <span className="font-medium">{dealTitle}</span>
                    {selectedStage && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px]"
                        style={{ borderColor: selectedStage.color }}
                      >
                        {selectedStage.name}
                      </Badge>
                    )}
                    {dealValue && (
                      <span className="text-muted-foreground">
                        {" "}· ${Number(dealValue).toLocaleString()}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">Skipped</span>
                )}
              </ReviewRow>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs">Internal notes (optional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Anything else worth remembering…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={5000}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-3 flex sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={back}
            disabled={isFirst || submitting}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {isLast ? (
            <Button
              onClick={() => create.mutate()}
              disabled={submitting || (!name.trim() && namedContacts.length === 0)}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              Create {customerLabel.toLowerCase()}
            </Button>
          ) : (
            <Button onClick={next}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModePick({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Building2;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/40"
          : "hover:bg-muted/40",
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

function ReviewRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Sparkles;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-card px-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
