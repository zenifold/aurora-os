import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceStore } from "@/stores/workspace-store";

/**
 * Workspace-scoped realtime subscription.
 * Listens to changes on tasks, projects, folders, divisions for the current
 * workspace and invalidates the relevant React Query caches so the UI updates
 * live for everyone.
 *
 * Mount once at the /app layout root.
 */
export function useWorkspaceRealtime() {
  const ws = useWorkspaceStore((s) => s.current);
  const qc = useQueryClient();

  useEffect(() => {
    if (!ws?.id) return;
    const channel = supabase
      .channel(`workspace:${ws.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${ws.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { project_id?: string; id?: string } | null;
          if (row?.project_id) {
            qc.invalidateQueries({ queryKey: ["tasks", row.project_id] });
          }
          if (row?.id) {
            qc.invalidateQueries({ queryKey: ["task", row.id] });
            qc.invalidateQueries({ queryKey: ["subtasks", row.id] });
          }
          qc.invalidateQueries({ queryKey: ["my-tasks"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: `workspace_id=eq.${ws.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string } | null;
          qc.invalidateQueries({ queryKey: ["projects", ws.id] });
          if (row?.id) qc.invalidateQueries({ queryKey: ["project", row.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "folders", filter: `workspace_id=eq.${ws.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string } | null;
          qc.invalidateQueries({ queryKey: ["folders", ws.id] });
          qc.invalidateQueries({ queryKey: ["folders"] });
          if (row?.id) qc.invalidateQueries({ queryKey: ["folder", row.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "divisions", filter: `workspace_id=eq.${ws.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["divisions", ws.id] });
          qc.invalidateQueries({ queryKey: ["divisions"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals", filter: `workspace_id=eq.${ws.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string } | null;
          qc.invalidateQueries({ queryKey: ["deals", ws.id] });
          if (row?.id) qc.invalidateQueries({ queryKey: ["deal", row.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deal_activities", filter: `workspace_id=eq.${ws.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { deal_id?: string } | null;
          if (row?.deal_id) qc.invalidateQueries({ queryKey: ["deal_activities", row.deal_id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts", filter: `workspace_id=eq.${ws.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["contacts", ws.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["notifications-unread"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ws?.id, qc]);
}
