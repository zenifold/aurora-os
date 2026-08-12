import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import type { Filter, Sort, Task } from "@/lib/types";
import { isPast, parseISO, isThisWeek, isToday } from "date-fns";

export type ViewKind = "table" | "kanban" | "calendar" | "gallery" | "timeline" | "board";

export interface SavedView {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  icon: string | null;
  filters: Filter[];
  sorts: Sort[];
  scope: "workspace" | "mine";
  is_pinned: boolean;
  sort_order: number;
  object_type_id: string | null;
  view_kind: ViewKind;
  is_shared: boolean;
  description: string | null;
}

export type PresetId =
  | "my-open"
  | "my-overdue"
  | "due-today"
  | "due-this-week"
  | "high-priority"
  | "no-due-date";

export interface ViewPreset {
  id: PresetId;
  name: string;
  icon: string;
  scope: "mine" | "workspace";
  predicate: (t: Task, userId: string) => boolean;
}

export const PRESETS: ViewPreset[] = [
  {
    id: "my-open",
    name: "My open",
    icon: "Inbox",
    scope: "mine",
    predicate: (t, uid) =>
      (t.assignee_ids ?? []).includes(uid) && t.status !== "done" && t.status !== "cancelled",
  },
  {
    id: "my-overdue",
    name: "My overdue",
    icon: "AlertCircle",
    scope: "mine",
    predicate: (t, uid) =>
      (t.assignee_ids ?? []).includes(uid) &&
      t.status !== "done" &&
      !!t.due_date &&
      isPast(parseISO(t.due_date)),
  },
  {
    id: "due-today",
    name: "Due today",
    icon: "CalendarClock",
    scope: "workspace",
    predicate: (t) => !!t.due_date && isToday(parseISO(t.due_date)) && t.status !== "done",
  },
  {
    id: "due-this-week",
    name: "Due this week",
    icon: "CalendarRange",
    scope: "workspace",
    predicate: (t) =>
      !!t.due_date &&
      isThisWeek(parseISO(t.due_date), { weekStartsOn: 1 }) &&
      t.status !== "done",
  },
  {
    id: "high-priority",
    name: "High priority",
    icon: "Flame",
    scope: "workspace",
    predicate: (t) => (t.priority === "high" || t.priority === "urgent") && t.status !== "done",
  },
  {
    id: "no-due-date",
    name: "No due date",
    icon: "CalendarOff",
    scope: "workspace",
    predicate: (t) => !t.due_date && t.status !== "done",
  },
];

export function useSavedViews() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saved-views", ws?.id, user?.id],
    enabled: !!ws && !!user,
    queryFn: async () => {
      // Own views + workspace-shared views
      const { data, error } = await supabase
        .from("user_saved_views")
        .select("*")
        .eq("workspace_id", ws!.id)
        .or(`user_id.eq.${user!.id},is_shared.eq.true`)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as SavedView[];
    },
  });
}

export function useCreateSavedView() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      icon?: string | null;
      filters?: Filter[];
      sorts?: Sort[];
      scope?: "workspace" | "mine";
      is_pinned?: boolean;
      object_type_id?: string | null;
      view_kind?: ViewKind;
      is_shared?: boolean;
      description?: string | null;
    }) => {
      if (!ws || !user) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("user_saved_views")
        .insert({
          user_id: user.id,
          workspace_id: ws.id,
          name: input.name,
          icon: input.icon ?? null,
          filters: (input.filters ?? []) as never,
          sorts: (input.sorts ?? []) as never,
          scope: input.scope ?? "workspace",
          is_pinned: input.is_pinned ?? false,
          object_type_id: input.object_type_id ?? null,
          view_kind: (input.view_kind ?? "table") as never,
          is_shared: input.is_shared ?? false,
          description: input.description ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SavedView;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-views"] });
      toast.success("View saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_saved_views").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-views"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SavedView> & { id: string }) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.is_pinned !== undefined) dbPatch.is_pinned = patch.is_pinned;
      if (patch.is_shared !== undefined) dbPatch.is_shared = patch.is_shared;
      if (patch.view_kind !== undefined) dbPatch.view_kind = patch.view_kind;
      if (patch.sort_order !== undefined) dbPatch.sort_order = patch.sort_order;
      if (patch.filters !== undefined) dbPatch.filters = patch.filters;
      if (patch.sorts !== undefined) dbPatch.sorts = patch.sorts;
      if (patch.description !== undefined) dbPatch.description = patch.description;
      const { error } = await supabase.from("user_saved_views").update(dbPatch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-views"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
