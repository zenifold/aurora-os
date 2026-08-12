import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, FileText, Send } from "lucide-react";
import {
  usePortalIntakeForms,
  useSubmitPortalIntakeForm,
  type PortalIntakeForm,
} from "@/hooks/use-client-portal";

export function PortalIntakeForms({ token }: { token: string }) {
  const { data: forms = [] } = usePortalIntakeForms(token);
  if (forms.length === 0) return null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Forms for you</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Please fill these in so the team can move forward.
      </p>
      <div className="space-y-3">
        {forms.map((f) => (
          <FormRow key={f.id} token={token} form={f} />
        ))}
      </div>
    </Card>
  );
}

function FormRow({ token, form }: { token: string; form: PortalIntakeForm }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{form.title}</span>
            {form.submitted && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Submitted
              </Badge>
            )}
          </div>
          {form.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{form.description}</p>
          )}
        </div>
        <Button size="sm" variant={form.submitted ? "outline" : "default"} onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : form.submitted ? "Submit again" : "Open form"}
        </Button>
      </div>
      {open && <FormFiller token={token} form={form} onDone={() => setOpen(false)} />}
    </div>
  );
}

function FormFiller({
  token,
  form,
  onDone,
}: {
  token: string;
  form: PortalIntakeForm;
  onDone: () => void;
}) {
  const submit = useSubmitPortalIntakeForm(token);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const setA = (id: string, v: unknown) => setAnswers((a) => ({ ...a, [id]: v }));

  const onSubmit = async () => {
    for (const f of form.fields) {
      if (f.required) {
        const v = answers[f.id];
        if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) {
          return alert(`"${f.label}" is required`);
        }
      }
    }
    await submit.mutateAsync({
      form_id: form.id,
      respondent_name: name || undefined,
      respondent_email: email || undefined,
      answers,
    });
    onDone();
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Your name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      {form.fields.map((f) => (
        <FieldInput key={f.id} field={f} value={answers[f.id]} onChange={(v) => setA(f.id, v)} />
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onDone}>Cancel</Button>
        <Button size="sm" onClick={onSubmit} disabled={submit.isPending}>
          <Send className="mr-2 h-4 w-4" /> Submit
        </Button>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: PortalIntakeForm["fields"][number];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <Label className="text-xs">
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  );
  const help = field.help ? (
    <p className="text-[11px] text-muted-foreground">{field.help}</p>
  ) : null;

  switch (field.type) {
    case "long_text":
      return (
        <div>
          {label}
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder={field.placeholder}
          />
          {help}
        </div>
      );
    case "email":
      return (
        <div>
          {label}
          <Input type="email" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
          {help}
        </div>
      );
    case "number":
      return (
        <div>
          {label}
          <Input
            type="number"
            value={(value as number | string) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
          {help}
        </div>
      );
    case "date":
      return (
        <div>
          {label}
          <Input
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );
    case "select":
      return (
        <div>
          {label}
          <Select value={(value as string) ?? ""} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {help}
        </div>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          {label}
          <div className="flex flex-wrap gap-2 rounded-md border border-border p-2">
            {(field.options ?? []).map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() =>
                    onChange(on ? selected.filter((x) => x !== o) : [...selected, o])
                  }
                  className={`rounded-md border px-2 py-0.5 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {help}
        </div>
      );
    }
    case "checkbox":
      return (
        <div className="flex items-start gap-2">
          <Checkbox
            checked={!!value}
            onCheckedChange={(c) => onChange(!!c)}
            id={field.id}
            className="mt-1"
          />
          <div>
            <Label htmlFor={field.id} className="cursor-pointer text-xs">{field.label}</Label>
            {help}
          </div>
        </div>
      );
    case "short_text":
    default:
      return (
        <div>
          {label}
          <Input
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
          {help}
        </div>
      );
  }
}
