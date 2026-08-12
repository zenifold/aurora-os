import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  listClientAccounts,
  upsertClientAccount,
  deleteClientAccount,
} from "@/lib/clients.functions";
import { getUnseenActivityCounts } from "@/lib/portal-activity.functions";
import { NewClientWizard } from "@/components/clients/NewClientWizard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Building2,
  Search,
  Download,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  ExternalLink,
  DollarSign,
  Users,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useVocabulary } from "@/hooks/use-vocabulary";

type Lifecycle = "lead" | "pre_sales" | "won" | "onboarding" | "active" | "churned";
type Tier = "standard" | "premium" | "strategic";
type SortKey =
  | "name"
  | "lifecycle"
  | "open_deal_count"
  | "open_deal_value"
  | "active_engagement_count"
  | "contract_value"
  | "health";

type ClientsSearch = {
  lifecycle?: Lifecycle | "all";
  tier?: Tier | "all";
  q?: string;
  sort?: SortKey;
  dir?: "asc" | "desc";
};

export const Route = createFileRoute("/app/clients/")({
  component: ClientsPage,
  validateSearch: (s: Record<string, unknown>): ClientsSearch => ({
    lifecycle: typeof s.lifecycle === "string" ? (s.lifecycle as Lifecycle | "all") : undefined,
    tier: typeof s.tier === "string" ? (s.tier as Tier | "all") : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    sort: typeof s.sort === "string" ? (s.sort as SortKey) : undefined,
    dir: s.dir === "asc" || s.dir === "desc" ? s.dir : undefined,
  }),
});

const LIFECYCLE_META: Record<Lifecycle, { label: string; class: string }> = {
  lead: { label: "Lead", class: "bg-muted text-muted-foreground" },
  pre_sales: { label: "Pre-sales", class: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  won: { label: "Won", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  onboarding: { label: "Onboarding", class: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  active: { label: "Active", class: "bg-primary/15 text-primary" },
  churned: { label: "Churned", class: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

const LIFECYCLE_ORDER: Lifecycle[] = ["lead", "pre_sales", "won", "onboarding", "active", "churned"];

const TIER_META: Record<Tier, { label: string; class: string }> = {
  standard: { label: "Standard", class: "bg-muted text-muted-foreground" },
  premium: { label: "Premium", class: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  strategic: { label: "Strategic", class: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300" },
};

function fmtMoney(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtMoneyCompact(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n || 0);
}

function ClientsPage() {
  const ws = useWorkspaceStore((s) => s.current);
  const vocab = useVocabulary();
  const nav = useNavigate();
  const list = useServerFn(listClientAccounts);
  const upsert = useServerFn(upsertClientAccount);
  const del = useServerFn(deleteClientAccount);
  const qc = useQueryClient();
  const search = Route.useSearch();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    website: "",
    tier: "standard" as Tier,
  });
  const [query, setQuery] = useState(search.q ?? "");
  const [lifecycleFilter, setLifecycleFilter] = useState<Lifecycle | "all">(
    search.lifecycle ?? "all",
  );
  const [tierFilter, setTierFilter] = useState<Tier | "all">(search.tier ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>(search.sort ?? "name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(search.dir ?? "asc");

  const openClient = (id: string) => {
    window.location.assign(`/app/clients/${id}`);
  };

  // Sync filter state to URL (so links / refresh preserve view)
  useEffect(() => {
    nav({
      to: "/app/clients",
      search: {
        lifecycle: lifecycleFilter === "all" ? undefined : lifecycleFilter,
        tier: tierFilter === "all" ? undefined : tierFilter,
        q: query || undefined,
        sort: sortKey === "name" ? undefined : sortKey,
        dir: sortDir === "asc" ? undefined : sortDir,
      },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycleFilter, tierFilter, query, sortKey, sortDir]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["client-accounts", ws?.id],
    queryFn: () => list({ data: { workspace_id: ws!.id } }),
    enabled: !!ws?.id,
  });

  const unseenFn = useServerFn(getUnseenActivityCounts);
  const { data: unseenCounts = {} } = useQuery({
    queryKey: ["client-unseen-counts", ws?.id],
    queryFn: () => unseenFn({ data: { workspaceId: ws!.id } }),
    enabled: !!ws?.id,
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          workspace_id: ws!.id,
          name: form.name,
          industry: form.industry || null,
          website: form.website || null,
          tier: form.tier,
        },
      }),
    onSuccess: () => {
      toast.success(`${vocab.customer.singular} created`);
      setOpen(false);
      setForm({ name: "", industry: "", website: "", tier: "standard" });
      qc.invalidateQueries({ queryKey: ["client-accounts", ws?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success(`${vocab.customer.singular} deleted`);
      qc.invalidateQueries({ queryKey: ["client-accounts", ws?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data.filter((a) => {
      if (lifecycleFilter !== "all" && a.lifecycle !== lifecycleFilter) return false;
      if (tierFilter !== "all" && a.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.industry ?? "").toLowerCase().includes(q) ||
        (a.legal_name ?? "").toLowerCase().includes(q) ||
        (a.website ?? "").toLowerCase().includes(q)
      );
    });

    const lifecycleRank = (l: string) =>
      LIFECYCLE_ORDER.indexOf(l as Lifecycle) === -1
        ? 99
        : LIFECYCLE_ORDER.indexOf(l as Lifecycle);
    const healthRank = (h: string) =>
      ({ red: 0, yellow: 1, unknown: 2, green: 3 })[h] ?? 99;

    rows.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "lifecycle":
          av = lifecycleRank(a.lifecycle);
          bv = lifecycleRank(b.lifecycle);
          break;
        case "open_deal_count":
          av = a.open_deal_count;
          bv = b.open_deal_count;
          break;
        case "open_deal_value":
          av = a.open_deal_value;
          bv = b.open_deal_value;
          break;
        case "active_engagement_count":
          av = a.active_engagement_count;
          bv = b.active_engagement_count;
          break;
        case "contract_value":
          av = a.contract_value;
          bv = b.contract_value;
          break;
        case "health":
          av = healthRank(a.health);
          bv = healthRank(b.health);
          break;
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [data, query, lifecycleFilter, tierFilter, sortKey, sortDir]);

  const counts = useMemo(() => {
    const c: Record<Lifecycle | "all", number> = {
      all: data.length,
      lead: 0,
      pre_sales: 0,
      won: 0,
      onboarding: 0,
      active: 0,
      churned: 0,
    };
    for (const a of data) c[a.lifecycle as Lifecycle] += 1;
    return c;
  }, [data]);

  const kpis = useMemo(() => {
    const openPipeline = data.reduce((s, a) => s + (a.open_deal_value || 0), 0);
    const contracted = data.reduce((s, a) => s + (a.contract_value || 0), 0);
    const activeCustomers = data.filter(
      (a) => a.lifecycle === "active" || a.lifecycle === "onboarding",
    ).length;
    const openDeals = data.reduce((s, a) => s + (a.open_deal_count || 0), 0);
    return { openPipeline, contracted, activeCustomers, openDeals };
  }, [data]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "lifecycle" ? "asc" : "desc");
    }
  }

  function exportCsv() {
    const headers = [
      "Name",
      "Legal Name",
      "Industry",
      "Website",
      "Tier",
      "Lifecycle",
      "Current Phase",
      "Open Deals",
      "Pipeline $",
      `${vocab.engagement.plural}`,
      "Contracted $",
      "Health",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...filtered.map((a) =>
        [
          a.name,
          a.legal_name ?? "",
          a.industry ?? "",
          a.website ?? "",
          a.tier ?? "",
          a.lifecycle,
          a.current_phase_name ?? "",
          a.open_deal_count,
          a.open_deal_value,
          a.active_engagement_count,
          a.contract_value,
          a.health,
        ]
          .map(escape)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${vocab.customer.plural.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div data-tour="clients-header">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> {vocab.customer.plural}
          </h1>
          <p className="text-sm text-muted-foreground">
            The single hub for every {vocab.customer.singular.toLowerCase()} — accounts, contacts, deals, SOWs, and lifecycle. Project work lives inside <span className="font-medium text-foreground">Spaces</span> in the sidebar and links here automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New {vocab.customer.singular.toLowerCase()}
          </Button>
          <NewClientWizard
            open={open}
            onOpenChange={setOpen}
            workspaceId={ws?.id ?? ""}
            customerLabel={vocab.customer.singular}
            contactLabel={vocab.contact.singular}
            opportunityLabel={vocab.opportunity.singular}
            onCreated={(id) => {
              nav({ to: "/app/clients/$accountId", params: { accountId: id } });
            }}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label={`Active ${vocab.customer.plural.toLowerCase()}`}
          value={String(kpis.activeCustomers)}
          sub={`${data.length} total`}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Open deals"
          value={String(kpis.openDeals)}
          sub={fmtMoneyCompact(kpis.openPipeline) + " pipeline"}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Open pipeline"
          value={fmtMoneyCompact(kpis.openPipeline)}
        />
        <KpiCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Contracted"
          value={fmtMoneyCompact(kpis.contracted)}
        />
      </div>

      {/* Lifecycle tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
        {(["all", ...LIFECYCLE_ORDER] as const).map((k) => {
          const active = lifecycleFilter === k;
          const label = k === "all" ? "All" : LIFECYCLE_META[k].label;
          return (
            <button
              key={k}
              onClick={() => setLifecycleFilter(k)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                active ? "bg-foreground text-background" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {label}
              <span className={`ml-1.5 tabular-nums ${active ? "opacity-70" : "opacity-60"}`}>
                {counts[k]}
              </span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as Tier | "all")}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="All tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="strategic">Strategic</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${vocab.customer.plural.toLowerCase()}…`}
              className="pl-8 h-8 w-64"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {data.length === 0
              ? `No ${vocab.customer.plural.toLowerCase()} yet. Create your first.`
              : `No ${vocab.customer.plural.toLowerCase()} match this filter.`}
          </p>
          {data.length === 0 && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New {vocab.customer.singular.toLowerCase()}
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
                <tr>
                  <SortableTh label="Name" k="name" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Lifecycle" k="lifecycle" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <th className="px-3 py-2 text-left font-medium">Tier</th>
                  <th className="px-3 py-2 text-left font-medium">Current phase</th>
                  <SortableTh label="Open deals" k="open_deal_count" align="right" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Pipeline $" k="open_deal_value" align="right" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableTh label={vocab.engagement.plural} k="active_engagement_count" align="right" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Contracted $" k="contract_value" align="right" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Health" k="health" sortKey={sortKey} dir={sortDir} onClick={toggleSort} />
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const meta = LIFECYCLE_META[a.lifecycle as Lifecycle] ?? LIFECYCLE_META.lead;
                  const tierMeta = a.tier ? TIER_META[a.tier as Tier] : null;
                  return (
                    <tr
                      key={a.id}
                      onClick={() => openClient(a.id)}
                      className="cursor-pointer border-t border-border hover:bg-accent/50"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{a.name}</div>
                          {unseenCounts[a.id]?.total > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-primary/15 text-primary border-transparent" title={`${unseenCounts[a.id].total} unseen portal event(s)`}>
                              {unseenCounts[a.id].requiresResponse > 0 ? `${unseenCounts[a.id].requiresResponse}!` : unseenCounts[a.id].total}
                            </Badge>
                          )}
                        </div>
                        {a.industry && (
                          <div className="text-xs text-muted-foreground">{a.industry}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={`${meta.class} border-transparent`} variant="outline">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        {tierMeta ? (
                          <Badge className={`${tierMeta.class} border-transparent`} variant="outline">
                            {tierMeta.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {a.current_phase_name ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: a.current_phase_color ?? "hsl(var(--primary))" }}
                            />
                            {a.current_phase_name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a.open_deal_count || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {fmtMoney(a.open_deal_value)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a.active_engagement_count || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {fmtMoney(a.contract_value)}
                      </td>
                      <td className="px-3 py-2.5">
                        <HealthDot health={a.health} />
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openClient(a.id)}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" /> Open
                            </DropdownMenuItem>
                            {a.website && (
                              <DropdownMenuItem
                                onClick={() => window.open(a.website!, "_blank", "noopener")}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" /> Visit website
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete ${a.name}? This removes the ${vocab.customer.singular.toLowerCase()} but keeps related projects.`,
                                  )
                                )
                                  remove.mutate(a.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Showing {filtered.length} of {data.length} {vocab.customer.plural.toLowerCase()}
          </div>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-3 hover-lift">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function SortableTh({
  label,
  k,
  sortKey,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
          active ? "text-foreground" : ""
        }`}
      >
        <span>{label}</span>
        <Icon className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

function HealthDot({ health }: { health: string }) {
  const map: Record<string, { color: string; label: string }> = {
    green: { color: "bg-emerald-500", label: "Healthy" },
    yellow: { color: "bg-amber-500", label: "At risk" },
    red: { color: "bg-red-500", label: "Critical" },
    unknown: { color: "bg-muted-foreground/40", label: "Unknown" },
  };
  const m = map[health] ?? map.unknown;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={m.label}>
      <span className={`h-2 w-2 rounded-full ${m.color}`} />
      {m.label}
    </span>
  );
}

// Suppress unused-link warning — Link still imported for downstream extension.
void Link;
