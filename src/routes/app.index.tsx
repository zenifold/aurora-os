import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useAuth } from "@/lib/auth-context";
import { useUIStore } from "@/stores/ui-store";
import { useCreateProject } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDown,
  Folder,
  LayoutDashboard,
  Mic,
  Plus,
  Settings2,
  Sparkles,
  StickyNote,
  Truck,
  BookOpen,
  ArrowDown,
  ArrowUp,
  HelpCircle,
} from "lucide-react";
import {
  ALL_WIDGETS,
  PRESETS,
  loadLayout,
  saveLayout,
  sizeToColSpan,
  type DashboardLayout,
  type PresetKey,
  type WidgetConfig,
  type WidgetKey,
  type WidgetSize,
} from "@/lib/dashboard-presets";
import {
  ActivityWidget,
  AgentRunsWidget,
  AtRiskProjectsWidget,
  EmptyProjectsCallout,
  MilestonesWidget,
  MyTasksWidget,
  PinnedPagesWidget,
  QuickActionsWidget,
  RecentNotesWidget,
  RecentProjectsWidget,
  StatsWidget,
  UpcomingMeetingsWidget,
  MyActionItemsWidget,
  RecentRecapsWidget,
} from "@/components/dashboard/widgets";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

const PRESET_ICON: Record<Exclude<PresetKey, "custom">, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  wiki: BookOpen,
  delivery: Truck,
};

function Dashboard() {
  const ws = useWorkspaceStore((s) => s.current);
  const { user } = useAuth();
  const navigate = useNavigate();
  const setQuickCaptureOpen = useUIStore((s) => s.setQuickCaptureOpen);
  const setHelpOpen = useUIStore((s) => s.setHelpOpen);
  const createProject = useCreateProject();
  const { data: profile } = useProfile();

  // Role-based landing redirect: if a profile.default_landing is set and
  // it's not /app, send the user there once on first render.
  useEffect(() => {
    const target = profile?.default_landing;
    if (target && target !== "/app" && typeof window !== "undefined") {
      const skip = sessionStorage.getItem("skip-role-landing");
      if (!skip) {
        sessionStorage.setItem("skip-role-landing", "1");
        navigate({ to: target });
      }
    }
  }, [profile?.default_landing, navigate]);

  const [layout, setLayout] = useState<DashboardLayout>(() => loadLayout(ws?.id, user?.id));
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useEffect(() => {
    setLayout(loadLayout(ws?.id, user?.id));
  }, [ws?.id, user?.id]);

  const updateLayout = (next: DashboardLayout) => {
    setLayout(next);
    saveLayout(ws?.id, user?.id, next);
  };

  const applyPreset = (key: Exclude<PresetKey, "custom">) => {
    updateLayout({ preset: key, widgets: PRESETS[key].widgets });
  };

  const greeting = getGreeting();
  const firstName = (user?.user_metadata?.display_name ?? user?.email ?? "").toString().split(/[ @]/)[0];

  const handleCreate = async () => {
    if (!ws) return;
    const proj = await createProject.mutateAsync({ name: "Untitled project" });
    navigate({ to: "/app/p/$projectId", params: { projectId: proj.id } });
  };

  const { data: hasProjects } = useQuery({
    queryKey: ["dashboard", "has-projects", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws!.id)
        .eq("is_archived", false);
      return (count ?? 0) > 0;
    },
  });

  const headline = useMemo(() => {
    if (layout.preset === "wiki") return "Your knowledge base";
    if (layout.preset === "delivery") return "Delivery overview";
    return `${greeting}, `;
  }, [layout.preset, greeting]);

  return (
    <div className="animate-page-in mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {layout.preset !== "custom" && (() => {
              const Ico = PRESET_ICON[layout.preset];
              return (
                <span className="icon-tile h-5 w-5">
                  <Ico className="h-3 w-3" />
                </span>
              );
            })()}
            {layout.preset === "custom" ? "Custom layout" : PRESETS[layout.preset].label}
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-soft" />
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>
          <h1 className="font-display truncate text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {layout.preset === "dashboard" ? (
              <>
                {headline}
                <span className="text-aura-gradient-anim">{firstName || "there"}</span>
              </>
            ) : (
              headline
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="press gap-1.5">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Layout</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Choose a layout</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(PRESETS) as Exclude<PresetKey, "custom">[]).map((k) => {
                const Ico = PRESET_ICON[k];
                return (
                  <DropdownMenuItem key={k} onClick={() => applyPreset(k)} className="flex items-start gap-2 py-2">
                    <Ico className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{PRESETS[k].label}</div>
                      <div className="text-xs text-muted-foreground">{PRESETS[k].description}</div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCustomizeOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" /> Customize widgets…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tour CTA */}
          <Button variant="ghost" size="sm" className="press gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Tour my workspace</span>
          </Button>

          {/* Create button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="press bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
                <Plus className="mr-1.5 h-4 w-4" /> Create
                <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setQuickCaptureOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" /> Quick capture task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/app/notes", search: { archived: false, project: undefined } })}>
                <StickyNote className="mr-2 h-4 w-4" /> New note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/app/meetings" })}>
                <Mic className="mr-2 h-4 w-4" /> New meeting
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCreate}>
                <Folder className="mr-2 h-4 w-4" /> New project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/app/sow-to-project" })}>
                <Sparkles className="mr-2 h-4 w-4" /> Project from SOW…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="seam mt-5" />

      {/* Widget grid */}
      <div className="stagger-children mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        {layout.widgets.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-medium">No widgets selected.</p>
            <Button onClick={() => setCustomizeOpen(true)} className="mt-3" variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" /> Add widgets
            </Button>
          </div>
        ) : (
          layout.widgets.map((w, idx) => (
            <div key={`${w.key}-${idx}`} className={sizeToColSpan(w.size)}>
              {renderWidget(w.key)}
            </div>
          ))
        )}
      </div>

      {/* Empty state for very fresh workspaces */}
      {hasProjects === false && (
        <div className="mt-8">
          <EmptyProjectsCallout onCreate={handleCreate} />
        </div>
      )}

      <CustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        layout={layout}
        onChange={updateLayout}
      />
    </div>
  );
}

function renderWidget(key: WidgetKey) {
  switch (key) {
    case "stats": return <StatsWidget />;
    case "quick_actions": return <QuickActionsWidget />;
    case "my_tasks": return <MyTasksWidget />;
    case "recent_projects": return <RecentProjectsWidget />;
    case "activity": return <ActivityWidget />;
    case "pinned_pages": return <PinnedPagesWidget />;
    case "recent_notes": return <RecentNotesWidget />;
    case "upcoming_meetings": return <UpcomingMeetingsWidget />;
    case "my_action_items": return <MyActionItemsWidget />;
    case "recent_recaps": return <RecentRecapsWidget />;
    case "at_risk_projects": return <AtRiskProjectsWidget />;
    case "milestones": return <MilestonesWidget />;
    case "agent_runs": return <AgentRunsWidget />;
  }
}

const SIZE_NEXT: Record<WidgetSize, WidgetSize> = { sm: "md", md: "lg", lg: "xl", xl: "sm" };
const SIZE_LABEL: Record<WidgetSize, string> = { sm: "S", md: "M", lg: "L", xl: "XL" };

function CustomizeDialog({
  open,
  onOpenChange,
  layout,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  layout: DashboardLayout;
  onChange: (l: DashboardLayout) => void;
}) {
  const [draft, setDraft] = useState<DashboardLayout>(layout);
  useEffect(() => setDraft(layout), [layout, open]);

  const isEnabled = (k: WidgetKey) => draft.widgets.some((w) => w.key === k);

  const toggle = (k: WidgetKey) => {
    const next = isEnabled(k)
      ? draft.widgets.filter((w) => w.key !== k)
      : [...draft.widgets, { key: k, size: "md" as WidgetSize }];
    setDraft({ preset: "custom", widgets: next });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...draft.widgets];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setDraft({ preset: "custom", widgets: next });
  };

  const cycleSize = (idx: number) => {
    const next = [...draft.widgets];
    next[idx] = { ...next[idx], size: SIZE_NEXT[next[idx].size] };
    setDraft({ preset: "custom", widgets: next });
  };

  const apply = () => {
    onChange(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize widgets</DialogTitle>
          <DialogDescription>
            Toggle widgets on or off, reorder them, and resize. Saved per workspace, just for you.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Active list */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active ({draft.widgets.length})
            </h3>
            <ul className="space-y-1.5">
              {draft.widgets.map((w, idx) => {
                const meta = ALL_WIDGETS.find((x) => x.key === w.key);
                if (!meta) return null;
                return (
                  <li
                    key={`${w.key}-${idx}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
                  >
                    <span className="flex-1 truncate text-sm font-medium">{meta.label}</span>
                    <button
                      type="button"
                      onClick={() => cycleSize(idx)}
                      title="Resize"
                      className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums hover:bg-muted/70"
                    >
                      {SIZE_LABEL[w.size]}
                    </button>
                    <button type="button" onClick={() => move(idx, -1)} className="text-muted-foreground hover:text-foreground" title="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => move(idx, 1)} className="text-muted-foreground hover:text-foreground" title="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Toggle list */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">All widgets</h3>
            <ul className="space-y-1.5">
              {ALL_WIDGETS.map((w) => (
                <li
                  key={w.key}
                  className="flex items-start gap-3 rounded-md border border-border bg-background p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{w.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{w.description}</p>
                  </div>
                  <Switch checked={isEnabled(w.key)} onCheckedChange={() => toggle(w.key)} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => setDraft({ preset: "dashboard", widgets: PRESETS.dashboard.widgets })}
          >
            Reset
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply}>Save layout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Working late";
}
