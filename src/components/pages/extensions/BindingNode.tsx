import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useQuery } from "@tanstack/react-query";
import { Database, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/use-profile";
import {
  applyTransform,
  describeBinding,
  type BindingAttrs,
  type BindingTransform,
} from "@/lib/bindings";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    binding: {
      insertBinding: (attrs: BindingAttrs) => ReturnType;
    };
  }
}

function useBindingValue(attrs: BindingAttrs): {
  loading: boolean;
  error: boolean;
  value: unknown;
  targetName?: string | null;
} {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const enabled = !!ws && (attrs.source !== "project" && attrs.source !== "task" ? true : !!attrs.targetId);

  const q = useQuery({
    queryKey: ["binding", attrs.source, attrs.targetId ?? "", attrs.field, ws?.id ?? ""],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      switch (attrs.source) {
        case "project": {
          const { data, error } = await supabase
            .from("projects")
            .select("*")
            .eq("id", attrs.targetId!)
            .maybeSingle();
          if (error) throw error;
          return { value: data ? (data as Record<string, unknown>)[attrs.field] : null, name: data?.name ?? null };
        }
        case "task": {
          const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", attrs.targetId!)
            .maybeSingle();
          if (error) throw error;
          return { value: data ? (data as Record<string, unknown>)[attrs.field] : null, name: data?.title ?? null };
        }
        case "workspace":
          return { value: (ws as unknown as Record<string, unknown>)?.[attrs.field] ?? null, name: ws?.name ?? null };
        case "me":
          if (attrs.field === "email") return { value: user?.email ?? null, name: null };
          return { value: profile?.display_name ?? user?.email?.split("@")[0] ?? null, name: null };
        case "date":
          return { value: attrs.field === "today" ? new Date().toISOString().slice(0, 10) : new Date().toISOString(), name: null };
        default:
          return { value: null, name: null };
      }
    },
  });

  return {
    loading: q.isLoading,
    error: q.isError,
    value: q.data?.value ?? null,
    targetName: q.data?.name ?? attrs.label ?? null,
  };
}

function BindingView({ node, selected }: NodeViewProps) {
  const attrs = node.attrs as BindingAttrs;
  const { loading, error, value, targetName } = useBindingValue(attrs);

  const rendered = applyTransform(value, (attrs.transform ?? null) as BindingTransform | null);
  const isEmpty = !loading && !error && (value === null || value === undefined || value === "");
  const display = error
    ? attrs.fallback ?? "—"
    : loading
      ? "…"
      : isEmpty
        ? attrs.fallback ?? "—"
        : rendered;

  const tooltip = describeBinding(attrs, targetName);

  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={`mx-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0 align-baseline text-[0.95em] leading-tight ${
        error
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : isEmpty
            ? "border-muted-foreground/30 bg-muted text-muted-foreground"
            : "border-primary/30 bg-primary/10 text-primary"
      } ${selected ? "ring-2 ring-primary/40" : ""}`}
      title={tooltip}
      data-binding-source={attrs.source}
      data-binding-field={attrs.field}
      data-binding-target={attrs.targetId ?? ""}
    >
      {error ? <AlertCircle className="h-3 w-3" /> : <Database className="h-3 w-3" />}
      <span className="font-medium">{display}</span>
    </NodeViewWrapper>
  );
}

export const BindingNode = Node.create({
  name: "binding",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      source: { default: "project" },
      targetId: { default: null },
      field: { default: "name" },
      transform: { default: null },
      fallback: { default: "—" },
      label: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-type='binding']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "binding" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BindingView);
  },
  addCommands() {
    return {
      insertBinding:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
