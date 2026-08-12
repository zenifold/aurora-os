import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDeals, useDealStages } from "@/hooks/use-crm";
import type { Deal, DealStage } from "@/lib/crm-types";

interface OwnerProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

function useDealOwnerProfiles(ownerIds: string[]) {
  const key = ownerIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["deal_owner_profiles", key],
    enabled: ownerIds.length > 0,
    queryFn: async (): Promise<OwnerProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ownerIds);
      if (error) throw error;
      return (data ?? []) as OwnerProfile[];
    },
  });
}

export interface PipelineKpis {
  openCount: number;
  openValue: number;
  weightedPipeline: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  winRate: number; // 0..1 over closed deals
  avgCycleDays: number; // closed deals only
  avgDealSize: number; // won
}

export interface StageFunnelRow {
  stage: DealStage;
  count: number;
  value: number;
  weighted: number;
}

export interface MonthForecastRow {
  monthKey: string; // YYYY-MM
  label: string;
  open: number;
  weighted: number;
  won: number;
}

export interface OwnerRow {
  ownerId: string | null;
  name: string;
  avatarUrl: string | null;
  openValue: number;
  weighted: number;
  wonValue: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
}

export interface LossReasonRow {
  reason: string;
  count: number;
  value: number;
}

export interface SourceRow {
  source: string;
  count: number;
  value: number;
  winRate: number;
}

export interface StaleDeal {
  deal: Deal;
  daysSinceUpdate: number;
}

const MS_PER_DAY = 86400000;

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

export function usePipelineAnalytics(staleThresholdDays = 14) {
  const { data: deals = [], isLoading: dealsLoading } = useDeals();
  const { data: stages = [], isLoading: stagesLoading } = useDealStages();
  const ownerIds = useMemo(
    () => Array.from(new Set(deals.map((d) => d.owner_id).filter((x): x is string => !!x))),
    [deals],
  );
  const { data: profiles = [] } = useDealOwnerProfiles(ownerIds);

  return useMemo(() => {
    const isLoading = dealsLoading || stagesLoading;
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const open = deals.filter((d) => d.status === "open");
    const won = deals.filter((d) => d.status === "won");
    const lost = deals.filter((d) => d.status === "lost");
    const closed = won.length + lost.length;

    const openValue = open.reduce((sum, d) => sum + (d.value ?? 0), 0);
    const weightedPipeline = open.reduce(
      (sum, d) => sum + ((d.value ?? 0) * (d.probability ?? 0)) / 100,
      0,
    );
    const wonValue = won.reduce((sum, d) => sum + (d.value ?? 0), 0);
    const winRate = closed === 0 ? 0 : won.length / closed;

    // cycle = won_at|lost_at - created_at, days
    const cycleSamples: number[] = [];
    for (const d of [...won, ...lost]) {
      const endIso = d.won_at ?? d.lost_at;
      if (!endIso) continue;
      const days = (new Date(endIso).getTime() - new Date(d.created_at).getTime()) / MS_PER_DAY;
      if (days >= 0 && Number.isFinite(days)) cycleSamples.push(days);
    }
    const avgCycleDays = cycleSamples.length
      ? cycleSamples.reduce((a, b) => a + b, 0) / cycleSamples.length
      : 0;

    const avgDealSize = won.length ? wonValue / won.length : 0;

    const kpis: PipelineKpis = {
      openCount: open.length,
      openValue,
      weightedPipeline,
      wonCount: won.length,
      wonValue,
      lostCount: lost.length,
      winRate,
      avgCycleDays,
      avgDealSize,
    };

    // Funnel: open deals grouped by stage
    const funnel: StageFunnelRow[] = stages
      .filter((s) => s.stage_type === "open")
      .map((s) => {
        const inStage = open.filter((d) => d.stage_id === s.id);
        const value = inStage.reduce((sum, d) => sum + (d.value ?? 0), 0);
        const weighted = inStage.reduce(
          (sum, d) => sum + ((d.value ?? 0) * (d.probability ?? 0)) / 100,
          0,
        );
        return { stage: s, count: inStage.length, value, weighted };
      });

    // Forecast by month (next 6 months from now), based on expected_close_date
    const now = new Date();
    const horizon: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      horizon.push(monthKey(d));
    }
    const forecastMap = new Map<string, MonthForecastRow>();
    for (const key of horizon) {
      forecastMap.set(key, { monthKey: key, label: monthLabel(key), open: 0, weighted: 0, won: 0 });
    }
    for (const d of open) {
      if (!d.expected_close_date) continue;
      const key = monthKey(new Date(d.expected_close_date));
      const row = forecastMap.get(key);
      if (!row) continue;
      row.open += d.value ?? 0;
      row.weighted += ((d.value ?? 0) * (d.probability ?? 0)) / 100;
    }
    for (const d of won) {
      if (!d.won_at) continue;
      const key = monthKey(new Date(d.won_at));
      const row = forecastMap.get(key);
      if (!row) continue;
      row.won += d.value ?? 0;
    }
    const forecast = Array.from(forecastMap.values());

    // Owner leaderboard
    const ownerAcc = new Map<string, OwnerRow>();
    const ensureOwner = (ownerId: string | null): OwnerRow => {
      const key = ownerId ?? "__unassigned";
      let row = ownerAcc.get(key);
      if (!row) {
        const profile = ownerId ? profileById.get(ownerId) : null;
        row = {
          ownerId,
          name: profile?.display_name ?? (ownerId ? "Teammate" : "Unassigned"),
          avatarUrl: profile?.avatar_url ?? null,
          openValue: 0,
          weighted: 0,
          wonValue: 0,
          wonCount: 0,
          lostCount: 0,
          winRate: 0,
        };
        ownerAcc.set(key, row);
      }
      return row;
    };
    for (const d of deals) {
      const row = ensureOwner(d.owner_id);
      if (d.status === "open") {
        row.openValue += d.value ?? 0;
        row.weighted += ((d.value ?? 0) * (d.probability ?? 0)) / 100;
      } else if (d.status === "won") {
        row.wonValue += d.value ?? 0;
        row.wonCount += 1;
      } else if (d.status === "lost") {
        row.lostCount += 1;
      }
    }
    for (const row of ownerAcc.values()) {
      const closedN = row.wonCount + row.lostCount;
      row.winRate = closedN === 0 ? 0 : row.wonCount / closedN;
    }
    const owners = Array.from(ownerAcc.values()).sort(
      (a, b) => b.weighted + b.wonValue - (a.weighted + a.wonValue),
    );

    // Loss reasons
    const lossMap = new Map<string, LossReasonRow>();
    for (const d of lost) {
      const reason = (d.lost_reason ?? "").trim() || "Unspecified";
      let row = lossMap.get(reason);
      if (!row) {
        row = { reason, count: 0, value: 0 };
        lossMap.set(reason, row);
      }
      row.count += 1;
      row.value += d.value ?? 0;
    }
    const lossReasons = Array.from(lossMap.values()).sort((a, b) => b.count - a.count);

    // Sources
    const srcMap = new Map<string, { open: number; won: number; lost: number; value: number }>();
    for (const d of deals) {
      const src = (d.source ?? "").trim() || "Unknown";
      let row = srcMap.get(src);
      if (!row) {
        row = { open: 0, won: 0, lost: 0, value: 0 };
        srcMap.set(src, row);
      }
      row.value += d.value ?? 0;
      if (d.status === "open") row.open += 1;
      else if (d.status === "won") row.won += 1;
      else if (d.status === "lost") row.lost += 1;
    }
    const sources: SourceRow[] = Array.from(srcMap.entries())
      .map(([source, r]) => {
        const closedN = r.won + r.lost;
        return {
          source,
          count: r.open + r.won + r.lost,
          value: r.value,
          winRate: closedN === 0 ? 0 : r.won / closedN,
        };
      })
      .sort((a, b) => b.value - a.value);

    // Stale deals
    const stale: StaleDeal[] = open
      .map((d) => ({
        deal: d,
        daysSinceUpdate: Math.floor((Date.now() - new Date(d.updated_at).getTime()) / MS_PER_DAY),
      }))
      .filter((s) => s.daysSinceUpdate >= staleThresholdDays)
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
      .slice(0, 10);

    return {
      isLoading,
      kpis,
      funnel,
      forecast,
      owners,
      lossReasons,
      sources,
      stale,
      stages,
      stageById,
    };
  }, [deals, stages, profiles, dealsLoading, stagesLoading, staleThresholdDays]);
}
