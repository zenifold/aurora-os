import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listIntakeForms,
  saveIntakeForm,
  deleteIntakeForm,
  listIntakeResponses,
  type IntakeFormInput,
} from "@/server/intake-forms.functions";
import type { IntakeForm, IntakeFormResponse } from "@/lib/intake-form-types";

export function useIntakeForms(projectId: string) {
  const fn = useServerFn(listIntakeForms);
  return useQuery({
    queryKey: ["intake-forms", projectId],
    queryFn: async () => {
      const r = await fn({ data: { project_id: projectId } });
      if ("error" in r) throw new Error(r.error);
      return r.forms as unknown as IntakeForm[];
    },
    enabled: !!projectId,
  });
}

export function useSaveIntakeForm(projectId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(saveIntakeForm);
  return useMutation({
    mutationFn: async (input: IntakeFormInput) => {
      const r = await fn({ data: input });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-forms", projectId] });
    },
  });
}

export function useDeleteIntakeForm(projectId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(deleteIntakeForm);
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fn({ data: { id, project_id: projectId } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-forms", projectId] });
    },
  });
}

export function useIntakeResponses(projectId: string, formId?: string) {
  const fn = useServerFn(listIntakeResponses);
  return useQuery({
    queryKey: ["intake-responses", projectId, formId ?? "all"],
    queryFn: async () => {
      const r = await fn({ data: { project_id: projectId, form_id: formId } });
      if ("error" in r) throw new Error(r.error);
      return r.responses as unknown as IntakeFormResponse[];
    },
    enabled: !!projectId,
  });
}
