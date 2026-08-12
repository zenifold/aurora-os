// Demo seed: creates a fresh workspace "Northwind Consulting" with a demo owner login,
// 14 team members, 20 clients, ~3 projects each, tasks, deals, contacts, milestones, etc.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

const DEMO_PASSWORD = "demo1234!";
const OWNER_EMAIL = "demo@northwind.test";

// ---- people ----
const TEAM = [
  { email: "demo@northwind.test", name: "Avery Chen", role: "owner", title: "Managing Partner", division: "delivery", skills: ["Strategy","Leadership","Architecture"] },
  { email: "morgan.lee@northwind.test", name: "Morgan Lee", role: "manager", title: "Delivery Director", division: "delivery", skills: ["PMO","Risk","Stakeholders"] },
  { email: "priya.patel@northwind.test", name: "Priya Patel", role: "manager", title: "Engineering Lead", division: "delivery", skills: ["TypeScript","AWS","System Design"] },
  { email: "jordan.kim@northwind.test", name: "Jordan Kim", role: "member", title: "Senior Engineer", division: "delivery", skills: ["React","Node","Postgres"] },
  { email: "sam.rivera@northwind.test", name: "Sam Rivera", role: "member", title: "Engineer", division: "delivery", skills: ["Python","Data","ML"] },
  { email: "tina.brooks@northwind.test", name: "Tina Brooks", role: "member", title: "Designer", division: "delivery", skills: ["Figma","UX","Design Systems"] },
  { email: "leo.fernandez@northwind.test", name: "Leo Fernandez", role: "member", title: "Engineer", division: "delivery", skills: ["Mobile","React Native","iOS"] },
  { email: "noor.haddad@northwind.test", name: "Noor Haddad", role: "member", title: "Data Engineer", division: "delivery", skills: ["dbt","Snowflake","Python"] },
  { email: "casey.morgan@northwind.test", name: "Casey Morgan", role: "manager", title: "Head of Sales", division: "sales", skills: ["Enterprise Sales","Negotiation"] },
  { email: "drew.nakamura@northwind.test", name: "Drew Nakamura", role: "member", title: "Account Executive", division: "sales", skills: ["Discovery","Proposal"] },
  { email: "ravi.shah@northwind.test", name: "Ravi Shah", role: "member", title: "Account Executive", division: "sales", skills: ["Outbound","SaaS"] },
  { email: "olivia.bennett@northwind.test", name: "Olivia Bennett", role: "manager", title: "Head of Operations", division: "ops", skills: ["FinOps","Hiring","Vendor Mgmt"] },
  { email: "ben.alvarez@northwind.test", name: "Ben Alvarez", role: "member", title: "Operations Analyst", division: "ops", skills: ["Reporting","Excel","SQL"] },
  { email: "mia.kowalski@northwind.test", name: "Mia Kowalski", role: "member", title: "People Ops", division: "ops", skills: ["Onboarding","HR"] },
];

const CLIENTS = [
  "Acme Robotics","Helios Health","Northwind Trading","Vertex Bank","Lumen Energy",
  "Polaris Logistics","Aurora Aerospace","BlueOcean Foods","Cinder Studios","Delphi Insurance",
  "Evergreen Realty","Fjord Telecom","Granite Mining","Harbor & Co Legal","Iris Beauty",
  "Juno Pharma","Kestrel Aviation","Loom Apparel","Meridian Hotels","Nimbus Cloud",
];

const PROJECT_TEMPLATES = [
  { suffix: "Platform Modernization", phase: "build", icon: "rocket", color: "#6366f1" },
  { suffix: "Mobile App v2", phase: "build", icon: "smartphone", color: "#ec4899" },
  { suffix: "Data Warehouse", phase: "discovery", icon: "database", color: "#0ea5e9" },
  { suffix: "AI Assistant POC", phase: "discovery", icon: "sparkles", color: "#a855f7" },
  { suffix: "Website Redesign", phase: "build", icon: "layout", color: "#14b8a6" },
  { suffix: "Compliance Audit", phase: "build", icon: "shield", color: "#f59e0b" },
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rint(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickN<T>(arr: T[], n: number): T[] {
  const a = [...arr]; const out: T[] = [];
  for (let i = 0; i < n && a.length; i++) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return out;
}
function daysFromNow(d: number) { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); }

async function main() {
  console.log("Cleaning previous demo workspace…");
  // Find old demo workspace and cascade-delete
  const { data: oldWs } = await sb.from("workspaces").select("id").eq("slug", "northwind-demo");
  if (oldWs && oldWs.length) {
    for (const w of oldWs) await sb.from("workspaces").delete().eq("id", w.id);
  }

  console.log("Creating users…");
  const userIds: Record<string, string> = {};
  for (const t of TEAM) {
    // Try to fetch existing
    const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = existing?.users.find((u) => u.email === t.email);
    let id = found?.id;
    if (!id) {
      const { data, error } = await sb.auth.admin.createUser({
        email: t.email, password: DEMO_PASSWORD, email_confirm: true,
        user_metadata: { display_name: t.name, full_name: t.name },
      });
      if (error) throw error;
      id = data.user!.id;
    } else {
      await sb.auth.admin.updateUserById(id, { password: DEMO_PASSWORD, email_confirm: true });
    }
    userIds[t.email] = id!;
    await sb.from("profiles").upsert({ id, display_name: t.name }, { onConflict: "id" });
  }

  const ownerId = userIds[OWNER_EMAIL];

  console.log("Creating workspace…");
  const { data: ws, error: wsErr } = await sb
    .from("workspaces")
    .insert({
      name: "Northwind Consulting", slug: "northwind-demo", owner_id: ownerId,
      kind: "hybrid", plan: "pro",
    })
    .select("id").single();
  if (wsErr) throw wsErr;
  const wsId = ws.id;

  // members + roles
  console.log("Adding members & roles…");
  for (const t of TEAM) {
    await sb.from("workspace_members").insert({ workspace_id: wsId, user_id: userIds[t.email] });
    await sb.from("user_roles").insert({ workspace_id: wsId, user_id: userIds[t.email], role: t.role });
    await sb.from("team_members").insert({
      workspace_id: wsId, user_id: userIds[t.email],
      role: t.title, weekly_capacity_hours: 40,
      hourly_cost: rint(60, 180), hourly_bill_rate: rint(150, 320),
      skills: t.skills, is_active: true,
    });
  }

  // divisions seeded by trigger; fetch and ensure slugs
  const { data: divs } = await sb.from("divisions").select("id,slug").eq("workspace_id", wsId);
  const divBySlug: Record<string, string> = Object.fromEntries((divs ?? []).map((d) => [d.slug, d.id]));

  // deal stages
  console.log("Seeding deal stages…");
  await sb.rpc("seed_default_deal_stages", { _workspace_id: wsId });
  const { data: stages } = await sb.from("deal_stages").select("id,name,stage_type,default_probability").eq("workspace_id", wsId).order("order_index");

  // contacts (one per client + a couple extra)
  console.log("Creating contacts…");
  const contacts: { id: string; company: string }[] = [];
  for (const company of CLIENTS) {
    const firstNames = ["Alex","Sam","Pat","Jamie","Robin","Taylor","Drew","Kai","Riley","Jess","Casey","Noor","Maya","Owen","Sofia"];
    const lastNames = ["Hill","Park","Singh","Rossi","Yamamoto","Müller","Diaz","Khan","Ortiz","Cohen","Owens","Bauer","Reed","Wong"];
    for (let i = 0; i < 2; i++) {
      const name = `${rand(firstNames)} ${rand(lastNames)}`;
      const { data: c } = await sb.from("contacts").insert({
        workspace_id: wsId, name, company,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@${company.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        title: rand(["VP Engineering","CTO","Head of Product","COO","Director of Ops","CFO","CMO","Head of Data"]),
        tags: pickN(["champion","economic-buyer","technical","procurement"], 1),
        created_by: ownerId,
      }).select("id").single();
      if (c) contacts.push({ id: c.id, company });
    }
  }

  // Deals (sales pipeline)
  console.log("Creating deals…");
  const salesUsers = TEAM.filter((t) => t.division === "sales").map((t) => userIds[t.email]);
  const dealCount = 38;
  for (let i = 0; i < dealCount; i++) {
    const company = rand(CLIENTS);
    const c = contacts.find((x) => x.company === company);
    const stage = rand(stages!);
    const value = rint(15, 450) * 1000;
    const owner = rand(salesUsers);
    const status = stage.stage_type === "won" ? "won" : stage.stage_type === "lost" ? "lost" : "open";
    const { data: d } = await sb.from("deals").insert({
      workspace_id: wsId, stage_id: stage.id, contact_id: c?.id, owner_id: owner,
      title: `${company} — ${rand(["Modernization","Mobile App","AI Assistant","Data Platform","Compliance","Discovery"])}`,
      value, currency: "USD", probability: stage.default_probability,
      expected_close_date: daysFromNow(rint(-30, 90)),
      source: rand(["Inbound","Referral","Outbound","Event","Partner"]),
      tags: pickN(["enterprise","mid-market","strategic"], 1),
      status,
      won_at: status === "won" ? new Date().toISOString() : null,
      lost_at: status === "lost" ? new Date().toISOString() : null,
      created_by: owner,
    }).select("id").single();
    if (d) {
      // a couple activities
      for (let k = 0; k < rint(1, 4); k++) {
        await sb.from("deal_activities").insert({
          workspace_id: wsId, deal_id: d.id, author_id: owner,
          activity_type: rand(["note","call","email","meeting"] as const),
          content: rand([
            "Intro call went well, sending proposal next week.",
            "Champion confirmed budget approved.",
            "Procurement asked for security questionnaire.",
            "Technical deep-dive scheduled with their architect.",
            "Sent revised SOW with phase 1 scope.",
          ]),
        });
      }
    }
  }

  // Projects per client
  console.log("Creating projects, milestones, tasks…");
  const deliveryUsers = TEAM.filter((t) => t.division !== "sales").map((t) => userIds[t.email]);
  const opsUsers = TEAM.filter((t) => t.division === "ops").map((t) => userIds[t.email]);

  for (const company of CLIENTS) {
    const projectsForClient = pickN(PROJECT_TEMPLATES, rint(2, 4));
    for (const tpl of projectsForClient) {
      const lead = rand(deliveryUsers);
      const { data: p } = await sb.from("projects").insert({
        workspace_id: wsId, name: `${company} — ${tpl.suffix}`,
        description: `Engagement with ${company} on ${tpl.suffix.toLowerCase()}.`,
        color: tpl.color, icon: tpl.icon,
        is_client_project: true, client_name: company,
        phase: rand(["discovery","build","launch","support"]),
        health: rand(["on_track","on_track","on_track","at_risk","off_track"]),
        contract_type: rand(["tm","fixed","retainer"]),
        start_date: daysFromNow(rint(-180, -10)),
        target_end_date: daysFromNow(rint(20, 200)),
        target_margin_pct: rint(20, 45),
        division_id: divBySlug["delivery"], created_by: lead,
      }).select("id").single();
      if (!p) continue;
      const projectId = p.id;

      // milestones
      const msNames = ["Kickoff","Discovery complete","MVP","UAT","Go-live","Phase 2 scoping"];
      for (let m = 0; m < 4; m++) {
        await sb.from("milestones").insert({
          workspace_id: wsId, project_id: projectId,
          name: msNames[m], milestone_type: m === 0 ? "kickoff" : m === 4 ? "launch" : "delivery",
          status: m < 2 ? "completed" : m === 2 ? "in_progress" : "upcoming",
          target_date: daysFromNow(-60 + m * 35),
          actual_date: m < 2 ? daysFromNow(-60 + m * 35 + rint(-3, 3)) : null,
          payment_amount: rint(20, 80) * 1000, is_paid: m < 2,
          order_index: m, created_by: lead,
        });
      }

      // get default workflow statuses (seeded by trigger)
      const { data: ws_st } = await sb.from("workflow_statuses").select("id,name,category").eq("project_id", projectId);
      const statusByCat: Record<string, { id: string; name: string }> = {};
      (ws_st ?? []).forEach((s) => { statusByCat[s.category] = s; });

      // tasks
      const taskCount = rint(12, 22);
      for (let t = 0; t < taskCount; t++) {
        const cat = rand(["backlog","todo","in_progress","review","done"]);
        const st = statusByCat[cat] ?? statusByCat["todo"];
        const assignees = pickN(deliveryUsers, rint(1, 2));
        const dueOffset = cat === "done" ? rint(-60, -1) : rint(-7, 30);
        const statusName = st.name.toLowerCase().includes("progress") ? "in_progress" :
                  st.name.toLowerCase() === "done" ? "done" :
                  st.name.toLowerCase().includes("review") ? "in_review" :
                  st.name.toLowerCase().includes("backlog") ? "backlog" : "todo";
        const { data: newTask } = await sb.from("tasks").insert({
          workspace_id: wsId, project_id: projectId,
          title: rand([
            "Set up CI/CD pipeline","Refactor auth module","Build pricing page","Migrate legacy data",
            "Design system audit","Write API contract","Add Stripe webhook","Performance review",
            "User research synthesis","Sprint planning","Fix flaky tests","Add OAuth provider",
            "Create admin dashboard","Implement search","Polish onboarding flow","Stand up staging env",
            "Wire analytics events","Write runbook","Pen test remediation","Q3 roadmap deck",
          ]) + ` for ${company}`,
          status: statusName,
          priority: rand(["low","medium","medium","high","urgent"] as const),
          assignee_ids: assignees, due_date: daysFromNow(dueOffset),
          start_date: daysFromNow(dueOffset - rint(2, 10)),
          tags: pickN(["frontend","backend","infra","design","qa","client"], rint(1, 2)),
          created_by: lead, position: t,
          completed_at: cat === "done" ? new Date().toISOString() : null,
        }).select("id").single();
        if (newTask) await sb.from("tasks").update({ workflow_status_id: st.id }).eq("id", newTask.id);
      }

      // resource allocations (a couple per project)
      for (const u of pickN(deliveryUsers, rint(2, 4))) {
        await sb.from("resource_allocations").insert({
          workspace_id: wsId, project_id: projectId,
          team_member_user_id: u, allocation_type: "team_member",
          start_date: daysFromNow(-30), end_date: daysFromNow(60),
          hours_per_week: rint(8, 32),
        }).then(() => {}, () => {});
      }
    }
  }

  // A couple of internal ops & sales projects (non-client)
  console.log("Adding internal projects…");
  for (const internal of [
    { name: "Internal — Hiring 2026", division: "ops", color: "#10b981", icon: "users" },
    { name: "Internal — FY26 Planning", division: "ops", color: "#0ea5e9", icon: "trending-up" },
    { name: "Sales — Pipeline Hygiene", division: "sales", color: "#f59e0b", icon: "filter" },
    { name: "Sales — Outbound Sprint", division: "sales", color: "#ef4444", icon: "send" },
  ]) {
    const lead = rand(internal.division === "sales" ? salesUsers : opsUsers);
    const { data: p } = await sb.from("projects").insert({
      workspace_id: wsId, name: internal.name,
      color: internal.color, icon: internal.icon, phase: "build", health: "on_track",
      contract_type: "tm", division_id: divBySlug[internal.division], created_by: lead,
    }).select("id").single();
    if (!p) continue;
    const { data: ws_st } = await sb.from("workflow_statuses").select("id,name,category").eq("project_id", p.id);
    for (let i = 0; i < 8; i++) {
      const st = rand(ws_st ?? []);
      const { data: nt } = await sb.from("tasks").insert({
        workspace_id: wsId, project_id: p.id,
        title: rand(["Schedule interviews","Update org chart","Refresh OKRs","Update CRM data","Review forecast","Refresh sales deck","Quarterly close","Vendor renewals"]),
        status: st?.name?.toLowerCase().includes("progress") ? "in_progress" : "todo",
        priority: rand(["low","medium","high"] as const),
        assignee_ids: [lead], due_date: daysFromNow(rint(-5, 20)),
        created_by: lead, position: i,
      }).select("id").single();
      if (nt && st) await sb.from("tasks").update({ workflow_status_id: st.id }).eq("id", nt.id);
    }
  }

  // Notifications-ish: notes for owner
  for (let i = 0; i < 6; i++) {
    await sb.from("notes").insert({
      workspace_id: wsId, created_by: ownerId,
      title: rand(["Follow up with Acme","Q3 themes","Hiring priorities","Pipeline review prep","Margin watch","Client renewal list"]),
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Quick capture from the demo seed." }] }] },
      is_pinned: i < 2, pin_order: i,
    });
  }

  console.log("\n✅ Demo ready.");
  console.log(`Workspace: Northwind Consulting (slug: northwind-demo)`);
  console.log(`Login: ${OWNER_EMAIL}  /  ${DEMO_PASSWORD}`);
  console.log(`All ${TEAM.length} users use the same password: ${DEMO_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
