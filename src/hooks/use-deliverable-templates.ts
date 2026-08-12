import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  generateTemplateWithAi,
} from "@/lib/deliverable-templates.functions";

export type TemplateRow = {
  id: string;
  workspace_id: string;
  kind: string;
  name: string;
  description: string | null;
  schema: { sections: Array<{ key: string; label: string; kind: string; required?: boolean; ai_prompt?: string }> };
  default_model: string | null;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export function useDeliverableTemplates(workspaceId: string | undefined) {
  const fn = useServerFn(listTemplates);
  return useQuery({
    queryKey: ["deliverable-templates", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => (await fn({ data: { workspace_id: workspaceId! } })) as TemplateRow[],
  });
}

export function useCreateTemplate(workspaceId: string) {
  const fn = useServerFn(createTemplate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: string;
      name: string;
      description?: string;
      schema: { sections: Array<{ key: string; label: string; kind: string; required?: boolean; ai_prompt?: string }> };
      default_model?: string;
      is_default?: boolean;
    }) => fn({ data: { workspace_id: workspaceId, ...input } as never }),
    onSuccess: () => {
      toast.success("Template created");
      qc.invalidateQueries({ queryKey: ["deliverable-templates", workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTemplate(workspaceId: string) {
  const fn = useServerFn(updateTemplate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      template_id: string;
      name?: string;
      description?: string | null;
      schema?: { sections: Array<{ key: string; label: string; kind: string; required?: boolean; ai_prompt?: string }> };
      default_model?: string;
      is_default?: boolean;
    }) => fn({ data: input as never }),
    onSuccess: () => {
      toast.success("Template updated");
      qc.invalidateQueries({ queryKey: ["deliverable-templates", workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTemplate(workspaceId: string) {
  const fn = useServerFn(deleteTemplate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template_id: string) => fn({ data: { template_id } }),
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["deliverable-templates", workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGenerateTemplate(workspaceId: string) {
  const fn = useServerFn(generateTemplateWithAi);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { description: string; base_kind?: string }) =>
      fn({ data: { workspace_id: workspaceId, ...input } as never }),
    onSuccess: (res) => {
      const r = res as { ok?: boolean; error?: string };
      if (r.ok === false) {
        toast.error(r.error ?? "AI template generation failed");
        return;
      }
      toast.success("Template drafted by AI");
      qc.invalidateQueries({ queryKey: ["deliverable-templates", workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
