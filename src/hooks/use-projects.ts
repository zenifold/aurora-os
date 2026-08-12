import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import type { Project } from "@/lib/types";
import { toast } from "sonner";
import { seedDefaultWorkflow } from "./use-workflow-templates";

export function useProjects() {
  const ws = useWorkspaceStore((s) => s.current);
  return useQuery({
    queryKey: ["projects", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", ws!.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data as Project;
    },
  });
}

export function useCreateProject() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      parent_id?: string | null;
      color?: string;
      folder_id?: string | null;
      description?: string | null;
      icon?: string;
      client_name?: string | null;
      is_client_project?: boolean;
      start_date?: string | null;
      target_end_date?: string | null;
      client_account_id?: string | null;
    }) => {
      if (!ws || !user) throw new Error("No workspace");

      // Default container based on workspace_mode when caller didn't pick one.
      let containerId = input.client_account_id ?? null;
      if (!containerId) {
        const mode = ws.workspace_mode ?? "client_services";
        if (mode === "solo") {
          const { data: personal } = await supabase
            .from("client_accounts")
            .select("id")
            .eq("workspace_id", ws.id)
            .eq("kind", "personal")
            .eq("owner_user_id", user.id)
            .maybeSingle();
          containerId = personal?.id ?? null;
        } else if (mode === "internal_team") {
          const { data: internal } = await supabase
            .from("client_accounts")
            .select("id")
            .eq("workspace_id", ws.id)
            .eq("kind", "internal")
            .maybeSingle();
          containerId = internal?.id ?? null;
        }
      }

      const { data: proj, error } = await supabase
        .from("projects")
        .insert({
          workspace_id: ws.id,
          name: input.name,
          description: input.description ?? null,
          parent_id: input.parent_id ?? null,
          color: input.color ?? "#8b5cf6",
          icon: input.icon ?? "folder",
          created_by: user.id,
          folder_id: input.folder_id ?? null,
          client_name: input.client_name ?? null,
          is_client_project: input.is_client_project ?? false,
          start_date: input.start_date ?? null,
          target_end_date: input.target_end_date ?? null,
          client_account_id: containerId,
        } as never)
        .select()
        .single();
      if (error) throw error;

      // Create a default table view
      await supabase.from("views").insert({
        workspace_id: ws.id,
        project_id: proj.id,
        name: "All tasks",
        view_type: "table",
        is_default: true,
        config: {},
        filters: [],
        sorts: [],
        created_by: user.id,
      });

      // Seed default workflow (3 statuses + all-pair transitions)
      await seedDefaultWorkflow(ws.id, proj.id);

      return proj as Project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", ws?.id] });
      toast.success("Project created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProject() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Project> & { id: string }) => {
      const { error } = await supabase.from("projects").update(patch as never).eq("id", id);
      if (error) throw error;

      // If the project was renamed, propagate the new name to AI-managed
      // pages whose titles embed the project name (e.g. "Old Name — Journal").
      if (typeof patch.name === "string" && patch.name.trim()) {
        const { data: linkedPages } = await supabase
          .from("pages" as never)
          .select("id,title,ai_managed,page_type")
          .eq("scope", "project")
          .eq("scope_id", id);
        const rows = (linkedPages ?? []) as Array<{ id: string; title: string; ai_managed: boolean; page_type: string }>;
        const newName = patch.name.trim();
        for (const pg of rows) {
          if (!pg.ai_managed) continue;
          const m = pg.title.match(/^(.*?)\s+—\s+(Journal|Plan|Overview|Brief)$/i);
          if (m && m[2]) {
            const nextTitle = `${newName} — ${m[2]}`;
            if (nextTitle !== pg.title) {
              await supabase.from("pages" as never).update({ title: nextTitle } as never).eq("id", pg.id);
            }
          }
        }
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects", ws?.id] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["page-dest-tasks"] });
    },
  });
}

export function useDeleteProject() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["projects", ws?.id] });
      const prev = qc.getQueryData<Project[]>(["projects", ws?.id]);
      const removed = prev?.find((p) => p.id === id);
      qc.setQueryData<Project[]>(["projects", ws?.id], (old) => (old ?? []).filter((p) => p.id !== id));
      return { prev, removed };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["projects", ws?.id], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: (_d, _id, ctx) => {
      const removed = ctx?.removed;
      toast.success("Project deleted", {
        action: removed
          ? {
              label: "Undo",
              onClick: async () => {
                const { id, created_at: _c, updated_at: _u, ...rest } = removed as Project & {
                  created_at?: string;
                  updated_at?: string;
                };
                const { error } = await supabase.from("projects").insert({ id, ...rest } as never);
                if (error) {
                  toast.error("Couldn't restore project");
                  return;
                }
                qc.invalidateQueries({ queryKey: ["projects", ws?.id] });
                toast.success("Project restored");
              },
            }
          : undefined,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["projects", ws?.id] }),
  });
}
