import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface Node {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

async function authed(): Promise<{ userId: string; workspaceId?: string } | null> {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user ? { userId: data.user.id } : null;
}

function walk(doc: unknown, fn: (n: Node) => void) {
  const visit = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as Node;
    fn(node);
    node.content?.forEach(visit);
    node.marks?.forEach((m) =>
      fn({ type: `mark:${m.type}`, attrs: m.attrs ?? {} } as Node),
    );
  };
  visit(doc);
}

// ===== Rebuild page_links from page content =====
export const rebuildPageLinks = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ page_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await authed();
    if (!me) throw new Error("Unauthorized");

    const { data: page } = await supabaseAdmin
      .from("pages")
      .select("id, workspace_id, content")
      .eq("id", data.page_id)
      .maybeSingle();
    if (!page) throw new Error("Page not found");

    type Row = {
      workspace_id: string;
      source_page_id: string;
      target_page_id: string | null;
      target_task_id: string | null;
      target_project_id: string | null;
      link_type: string;
      source_block_id: string | null;
    };
    const rows: Row[] = [];
    let currentBlock: string | null = null;

    walk(page.content, (n) => {
      if (n.attrs?.blockId && typeof n.attrs.blockId === "string") currentBlock = n.attrs.blockId;
      const a = n.attrs ?? {};
      if (n.type === "wikiLink" && typeof a.pageId === "string") {
        rows.push({
          workspace_id: page.workspace_id,
          source_page_id: page.id,
          target_page_id: a.pageId,
          target_task_id: null,
          target_project_id: null,
          link_type: "wiki",
          source_block_id: currentBlock,
        });
      } else if (n.type === "embed") {
        const kind = a.kind as string | undefined;
        const refId = a.refId as string | undefined;
        if (kind && refId) {
          rows.push({
            workspace_id: page.workspace_id,
            source_page_id: page.id,
            target_page_id: kind === "page" ? refId : null,
            target_task_id: kind === "task" ? refId : null,
            target_project_id: null,
            link_type: "embed",
            source_block_id: currentBlock,
          });
        }
      } else if (n.type === "binding") {
        const source = a.source as string | undefined;
        const targetId = a.targetId as string | undefined;
        if (source === "project" && targetId) {
          rows.push({
            workspace_id: page.workspace_id,
            source_page_id: page.id,
            target_page_id: null,
            target_task_id: null,
            target_project_id: targetId,
            link_type: "binding",
            source_block_id: currentBlock,
          });
        } else if (source === "task" && targetId) {
          rows.push({
            workspace_id: page.workspace_id,
            source_page_id: page.id,
            target_page_id: null,
            target_task_id: targetId,
            target_project_id: null,
            link_type: "binding",
            source_block_id: currentBlock,
          });
        }
      } else if (n.type === "mention") {
        const id = a.id as string | undefined;
        const kind = a.kind as string | undefined;
        if (id && (kind === "page" || kind === "task")) {
          rows.push({
            workspace_id: page.workspace_id,
            source_page_id: page.id,
            target_page_id: kind === "page" ? id : null,
            target_task_id: kind === "task" ? id : null,
            target_project_id: null,
            link_type: "mention",
            source_block_id: currentBlock,
          });
        }
      }
    });

    // Replace
    await supabaseAdmin.from("page_links").delete().eq("source_page_id", page.id);
    if (rows.length > 0) {
      await supabaseAdmin.from("page_links").insert(rows as never);
    }
    return { count: rows.length };
  });

// ===== Publish to portal =====
export const setPagePortalPublished = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ page_id: z.string().uuid(), published: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await authed();
    if (!me) throw new Error("Unauthorized");
    const { data: row, error } = await supabaseAdmin
      .from("pages")
      .update({
        is_portal_published: data.published,
        portal_published_at: data.published ? new Date().toISOString() : null,
        portal_published_by: data.published ? me.userId : null,
      } as never)
      .eq("id", data.page_id)
      .select("id, is_portal_published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

// ===== Attribution upsert / review =====
const AttrSchema = z.object({
  page_id: z.string().uuid(),
  block_id: z.string().min(1).max(120),
  source: z.enum(["ai", "human", "agent"]).default("ai"),
  agent_name: z.string().max(120).nullish(),
  agent_id: z.string().uuid().nullish(),
  model: z.string().max(120).nullish(),
  prompt: z.string().max(4000).nullish(),
  reasoning: z.string().max(4000).nullish(),
  status: z.enum(["draft", "review", "published", "reverted"]).default("draft"),
});

export const upsertBlockAttribution = createServerFn({ method: "POST" })
  .inputValidator((d) => AttrSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await authed();
    if (!me) throw new Error("Unauthorized");
    const { data: page } = await supabaseAdmin
      .from("pages")
      .select("workspace_id")
      .eq("id", data.page_id)
      .maybeSingle();
    if (!page) throw new Error("Page not found");

    const payload = {
      workspace_id: page.workspace_id,
      page_id: data.page_id,
      block_id: data.block_id,
      source: data.source,
      agent_name: data.agent_name ?? null,
      agent_id: data.agent_id ?? null,
      model: data.model ?? null,
      prompt: data.prompt ?? null,
      reasoning: data.reasoning ?? null,
      status: data.status,
      created_by: me.userId,
    };
    const { data: row, error } = await supabaseAdmin
      .from("page_block_attributions" as never)
      .upsert(payload as never, { onConflict: "page_id,block_id" } as never)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return row;
  });

export const reviewBlockAttribution = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "review", "published", "reverted"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await authed();
    if (!me) throw new Error("Unauthorized");
    const { error } = await supabaseAdmin
      .from("page_block_attributions" as never)
      .update({
        status: data.status,
        reviewed_by: me.userId,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
