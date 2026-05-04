import { useState } from "react";
import type { RecurrenceRule, RecurrenceFreq } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Repeat, X } from "lucide-react";

interface Props {
  value: RecurrenceRule | null | undefined;
  onChange: (next: RecurrenceRule | null) => void;
}

const FREQ_LABEL: Record<RecurrenceFreq, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

export function RecurrencePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rule = value ?? null;

  const summary = rule
    ? `Every ${rule.interval > 1 ? rule.interval + " " : ""}${FREQ_LABEL[rule.freq]}${rule.interval > 1 ? "s" : ""}`
    : "Doesn't repeat";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start font-normal">
          <Repeat className="mr-2 h-3.5 w-3.5" />
          <span className="flex-1 truncate text-left">{summary}</span>
          {rule && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-accent"
              aria-label="Clear recurrence"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 p-3" align="start">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Repeat
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Every</span>
          <Input
            type="number"
            min={1}
            max={365}
            value={rule?.interval ?? 1}
            onChange={(e) =>
              onChange({
                freq: rule?.freq ?? "weekly",
                interval: Math.max(1, Number(e.target.value) || 1),
                until: rule?.until ?? null,
              })
            }
            className="h-8 w-16"
          />
          <Select
            value={rule?.freq ?? "weekly"}
            onValueChange={(v) =>
              onChange({
                freq: v as RecurrenceFreq,
                interval: rule?.interval ?? 1,
                until: rule?.until ?? null,
              })
            }
          >
            <SelectTrigger className="h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">day(s)</SelectItem>
              <SelectItem value="weekly">week(s)</SelectItem>
              <SelectItem value="monthly">month(s)</SelectItem>
              <SelectItem value="yearly">year(s)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Ends on (optional)</label>
          <Input
            type="date"
            value={rule?.until ?? ""}
            onChange={(e) =>
              onChange({
                freq: rule?.freq ?? "weekly",
                interval: rule?.interval ?? 1,
                until: e.target.value || null,
              })
            }
            className="h-8"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Next occurrence is created automatically when this task is marked Done.
        </p>
        {rule && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Remove repeat
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
