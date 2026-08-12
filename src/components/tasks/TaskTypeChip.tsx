import { Check, Lock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TASK_TYPES,
  TASK_TYPE_META,
  PARENT_OF,
  getTaskTypeMeta,
  type TaskType,
} from "@/lib/task-types";

/**
 * Returns null if `next` is a legal task_type given the parent context and
 * whether the task already has children. Otherwise returns a short human
 * explanation suitable for a tooltip.
 *
 * Nesting rules (mirrors PARENT_OF in @/lib/task-types):
 *  - initiative: must be top-level (no parent).
 *  - epic:       must live under an initiative.
 *  - milestone:  top-level checkpoint.
 *  - task:       top-level OR under a milestone/initiative.
 *  - subtask:    must live under a task; cannot itself have children.
 */
export function validateTaskTypeChange(
  next: TaskType,
  ctx: { parentType?: TaskType | null; hasChildren?: boolean },
): string | null {
  const { parentType, hasChildren } = ctx;
  const required = PARENT_OF[next];

  // Subtask is a leaf — can't have children.
  if (next === "subtask" && hasChildren) {
    return "Subtasks can't have children. Move or delete the nested items first.";
  }
  // Top-level only types.
  if (required === null && parentType != null) {
    if (next === "initiative") return "Initiatives must be top-level.";
    if (next === "milestone" && parentType === "subtask") {
      return "Milestones can't live under a subtask.";
    }
  }
  // Types that require a specific parent.
  if (required && parentType !== undefined && required !== parentType) {
    const reqLabel = TASK_TYPE_META[required].label.toLowerCase();
    return `${TASK_TYPE_META[next].label}s must live under a ${reqLabel}.`;
  }
  return null;
}

/**
 * Chip that displays the current task_type and, on click, lets the user
 * change it. Two visual modes:
 *  - default: pill with icon + label, used in the task detail header.
 *  - iconOnly: just the colored icon, used inline in dense table/kanban rows
 *    so users can re-classify a row without opening the detail panel.
 *
 * Pass `parentType` and `hasChildren` so the chip can grey out invalid
 * choices (e.g. "subtask" when the row has children, "epic" without an
 * initiative parent) with an explanation tooltip.
 */
export function TaskTypeChip({
  value,
  onChange,
  disabled = false,
  iconOnly = false,
  size = 14,
  parentType,
  hasChildren,
}: {
  value: string | null | undefined;
  onChange: (next: TaskType) => void;
  disabled?: boolean;
  iconOnly?: boolean;
  size?: number;
  parentType?: TaskType | null;
  hasChildren?: boolean;
}) {
  const meta = getTaskTypeMeta(value);
  const Icon = meta.icon;

  const trigger = iconOnly ? (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      title={`${meta.label} — click to change type`}
      aria-label={`Task type: ${meta.label}. Click to change.`}
      className="inline-flex shrink-0 items-center justify-center rounded p-0.5 transition-colors hover:bg-muted disabled:opacity-60"
    >
      <Icon style={{ width: size, height: size, color: meta.color }} />
    </button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide transition-colors hover:brightness-110 disabled:opacity-60"
      style={{ background: meta.tint, color: meta.color }}
      aria-label={`Task type: ${meta.label}. Click to change.`}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </button>
  );

  if (disabled) return trigger;

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Change task type
        </p>
        <ul className="space-y-0.5">
          {TASK_TYPES.map((t) => {
            const m = TASK_TYPE_META[t];
            const ItemIcon = m.icon;
            const selected = t === (value ?? "task");
            const invalidReason = selected
              ? null
              : validateTaskTypeChange(t, { parentType, hasChildren });
            const isInvalid = invalidReason !== null;
            return (
              <li key={t}>
                <button
                  type="button"
                  disabled={isInvalid}
                  title={invalidReason ?? undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isInvalid) return;
                    onChange(t);
                  }}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  aria-disabled={isInvalid}
                >
                  <span
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded"
                    style={{ background: m.tint, color: m.color }}
                  >
                    <ItemIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{m.label}</span>
                      {selected ? (
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : isInvalid ? (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      ) : null}
                    </span>
                    {(invalidReason ?? m.description) && (
                      <span className="block text-[11px] leading-snug text-muted-foreground">
                        {invalidReason ?? m.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

      </PopoverContent>
    </Popover>
  );
}
