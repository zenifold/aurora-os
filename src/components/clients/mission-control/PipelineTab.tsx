import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Star, FileText, Plus, MoreHorizontal, Copy, Trash2, Pencil, ArrowRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WonDealBridgeDialog } from "./WonDealBridgeDialog";

type Deal = {
  id: string;
  title: string;
  status: string;
  value: number | null;
  currency: string | null;
  stage_id: string | null;
  handed_off_project_id: string | null;
  expected_close_date: string | null;
  description: string | null;
  deal_contacts?: { id: string; role: string; is_primary: boolean; contact: { name?: string | null } | null }[] | null;
};
type Stage = { id: string; name: string; color: string | null; stage_type: string };
type Sow = {
  id: string; title: string; version: number; status: string; total: number | null;
  currency: string | null; updated_at: string; deal_id: string; deal_title?: string | null;
};

function fmtMoney(v: number | null | undefined, c: string | null | undefined) {
  if (v == null) return "—";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c || "USD", maximumFractionDigits: 0 }).format(v); }
  catch { return `${c ?? ""} ${v}`; }
}

export function PipelineTab({
  accountId,
  deals,
  stages,
  sows,
  onNewSow,
  onRenameSow,
  onDuplicateSow,
  onDeleteSow,
}: {
  accountId: string;
  folderId?: string | null;
  deals: Deal[];
  stages: Stage[];
  sows: Sow[];
  /** Create a new SOW for a specific deal. */
  onNewSow: (dealId: string) => void;
  onRenameSow: (id: string, title: string) => void;
  onDuplicateSow: (id: string) => void;
  onDeleteSow: (id: string) => void;
}) {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const sowsByDeal = new Map<string, Sow[]>();
  for (const s of sows) {
    const arr = sowsByDeal.get(s.deal_id) ?? [];
    arr.push(s);
    sowsByDeal.set(s.deal_id, arr);
  }
  const openDeals = deals.filter((d) => d.status === "open");
  const wonDeals = deals.filter((d) => d.status === "won");
  const lostDeals = deals.filter((d) => d.status === "lost");

  const [bridge, setBridge] = useState<{ dealId: string; name: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Opportunities</h3>
        <p className="text-xs text-muted-foreground">SOWs live inside each opportunity</p>
      </div>

      {deals.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No opportunities yet.</Card>
      ) : (
        [{ key: "open", label: "Open", items: openDeals },
         { key: "won", label: "Won", items: wonDeals },
         { key: "lost", label: "Lost", items: lostDeals }].map((grp) => grp.items.length > 0 && (
          <div key={grp.key}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{grp.label} ({grp.items.length})</div>
            <div className="grid gap-3">
              {grp.items.map((d) => {
                const stage = d.stage_id ? stageById.get(d.stage_id) : null;
                const dealSows = sowsByDeal.get(d.id) ?? [];
                return (
                  <Card key={d.id} className="overflow-hidden hover:border-primary/40 transition-colors">
                    <Link
                      to="/app/clients/$accountId/deal/$dealId"
                      params={{ accountId, dealId: d.id }}
                      className="block p-4 group"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium group-hover:text-primary">
                            {d.title}
                            <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {d.description && <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.description}</div>}
                          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                            {stage && (
                              <span className="inline-flex items-center gap-1">
                                <span className="inline-block h-2 w-2 rounded-full" style={{ background: stage.color ?? "var(--primary)" }} />
                                {stage.name}
                              </span>
                            )}
                            {d.expected_close_date && <span>Close {new Date(d.expected_close_date).toLocaleDateString()}</span>}
                            <span>{dealSows.length} {dealSows.length === 1 ? "SOW" : "SOWs"}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{fmtMoney(d.value ?? null, d.currency)}</div>
                          <Badge variant={d.status === "won" ? "default" : d.status === "lost" ? "destructive" : "secondary"} className="mt-1">{d.status}</Badge>
                        </div>
                      </div>
                      {d.deal_contacts && d.deal_contacts.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {d.deal_contacts.map((dc) => (
                            <Badge key={dc.id} variant="outline" className="gap-1">
                              {dc.is_primary && <Star className="h-3 w-3" />}
                              {dc.contact?.name ?? "—"}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Link>

                    {/* Nested SOWs */}
                    <div className="border-t border-border bg-muted/20 px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">SOWs</div>
                        <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); onNewSow(d.id); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> New SOW
                        </Button>
                      </div>
                      {dealSows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No SOWs drafted for this opportunity yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dealSows.map((s) => (
                            <div key={s.id} className="flex items-center justify-between gap-2 rounded border border-border bg-background px-3 py-2">
                              <Link
                                to="/app/clients/$accountId/deal/$dealId"
                                params={{ accountId, dealId: d.id }}
                                className="flex items-center gap-2 min-w-0 flex-1 hover:text-primary"
                              >
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate text-sm">{s.title}</span>
                                <Badge variant="outline" className="text-[10px] h-4 px-1">v{s.version}</Badge>
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 capitalize">{s.status.replace(/_/g, " ")}</Badge>
                              </Link>
                              <span className="text-xs text-muted-foreground shrink-0">{fmtMoney(s.total, s.currency)}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={() => {
                                    const t = window.prompt("Rename SOW", s.title);
                                    if (t && t.trim() && t !== s.title) onRenameSow(s.id, t.trim());
                                  }}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDuplicateSow(s.id)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => {
                                    if (window.confirm(`Delete "${s.title}"?`)) onDeleteSow(s.id);
                                  }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {d.status === "won" && (
                      <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2">
                        {d.handed_off_project_id ? (
                          <Link to="/app/p/$projectId" params={{ projectId: d.handed_off_project_id }} className="text-xs text-primary hover:underline">
                            → View linked project
                          </Link>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground">No project yet</span>
                            <Button size="sm" variant="outline" onClick={() => setBridge({ dealId: d.id, name: d.title })}>
                              Spin up project
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {bridge && (
        <WonDealBridgeDialog
          open={true}
          onOpenChange={(v) => !v && setBridge(null)}
          dealId={bridge.dealId}
          defaultName={bridge.name}
          accountId={accountId}
        />
      )}
    </div>
  );
}
