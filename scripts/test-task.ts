import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }});
const { data: ws } = await sb.from("workspaces").select("id,owner_id").eq("slug","northwind-demo").single();
const { data: p } = await sb.from("projects").select("id").eq("workspace_id", ws!.id).limit(1).single();
const { data: st } = await sb.from("workflow_statuses").select("id,name").eq("project_id", p!.id);
console.log("statuses", st);
const r = await sb.from("tasks").insert({
  workspace_id: ws!.id, project_id: p!.id, title: "test",
  status: "todo", workflow_status_id: st![0].id, priority: "medium",
  assignee_ids: [ws!.owner_id], created_by: ws!.owner_id,
}).select();
console.log("result", JSON.stringify(r, null, 2));
