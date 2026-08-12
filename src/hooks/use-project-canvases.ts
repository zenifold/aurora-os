import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export interface ProjectCanvasScene {
  type?: "excalidraw";
  elements?: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface ProjectCanvas {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  scene: ProjectCanvasScene;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjectCanvases(projectId: string | null | undefined) {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["project-canvases", projectId],
    enabled: !!projectId && !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_canvases")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectCanvas[];
    },
  });

  useEffect(() => {
    if (!projectId) return;
    const ch = supabase.channel(
      `project-canvases-${projectId}-${Math.random().toString(36).slice(2)}`,
    );
    ch.on(
      "postgres_changes" as never,
      {
        event: "*",
        schema: "public",
        table: "project_canvases",
        filter: `project_id=eq.${projectId}`,
      },
      () => qc.invalidateQueries({ queryKey: ["project-canvases", projectId] }),
    ).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, qc]);

  return query;
}

export function useCreateProjectCanvas() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title?: string;
      scene?: ProjectCanvasScene;
    }) => {
      if (!ws || !user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("project_canvases")
        .insert({
          workspace_id: ws.id,
          project_id: input.projectId,
          title: input.title ?? "Untitled canvas",
          scene: (input.scene ?? {
            type: "excalidraw",
            elements: [],
            appState: {},
            files: {},
          }) as never,
          created_by: user.id,
        } as never)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as ProjectCanvas;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["project-canvases", row.project_id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

export function useUpdateProjectCanvas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      projectId: string;
      patch: Partial<Pick<ProjectCanvas, "title" | "scene">>;
    }) => {
      const { error } = await supabase
        .from("project_canvases")
        .update(input.patch as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["project-canvases", vars.projectId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

export function useDeleteProjectCanvas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from("project_canvases")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["project-canvases", vars.projectId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
}
