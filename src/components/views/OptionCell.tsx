import { useState } from "react";
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
import { Check, ChevronsUpDown } from "lucide-react";

export interface OptionCellOption {
  value: string;
  label: string;
  color?: string;
  description?: string;
}

interface Props {
  value: string | null | undefined;
  options: OptionCellOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** "pill" renders a soft tinted badge; "dot" renders a small color dot + label. */
  variant?: "pill" | "dot";
  ariaLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Optional render after primary label inside the trigger (e.g. count). */
  trailing?: React.ReactNode;
}

/**
 * Compact, keyboard-accessible option picker for table cells.
 * Replaces native <Select> with a search-enabled popover that surfaces
 * colored swatches and is friendly on dense rows.
 */
export function OptionCell({
  value,
  options,
  onChange,
  placeholder = "—",
  variant = "pill",
  ariaLabel,
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  trailing,
}: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const color = current?.color;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? current?.label ?? placeholder}
          className="group/cell flex h-7 w-full items-center justify-between gap-1.5 rounded px-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {current ? (
            variant === "pill" ? (
              <span
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-[2px] text-[11px] font-medium"
                style={
                  color
                    ? {
                        background: `color-mix(in oklab, ${color} 18%, transparent)`,
                        color,
                      }
                    : undefined
                }
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: color ?? "currentColor" }}
                />
                <span className="truncate">{current.label}</span>
              </span>
            ) : (
              <span className="inline-flex max-w-full items-center gap-1.5 truncate">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: color ?? "hsl(var(--muted-foreground))" }}
                />
                <span className="truncate">{current.label}</span>
              </span>
            )
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            {trailing}
            <ChevronsUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/cell:opacity-100" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-8" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: o.color ?? "hsl(var(--muted-foreground))" }}
                  />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.value === value && <Check className="h-3.5 w-3.5 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
