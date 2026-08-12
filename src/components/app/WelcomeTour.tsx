import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  X,
  Check,
  ArrowRight,
  FolderKanban,
  Users,
  TrendingUp,
  FileSignature,
  FileText,
  StickyNote,
  UserPlus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { SpotlightTour, type SpotlightStop } from "@/components/app/SpotlightTour";
import logoUrl from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  AUDIENCE_COPY,
  clearTourPlan,
  loadTourPlan,
  saveTourPlan,
  type WelcomeTourPlan,
} from "@/lib/welcome-tour";

interface TourStep {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  cta: string;
  go: () => void;
  available: boolean;
}

/**
 * Floating, persona-aware welcome experience shown after onboarding.
 * Renders nothing when no tour plan exists or once dismissed/completed.
 */
export function WelcomeTour() {
  const navigate = useNavigate();
  const currentWs = useWorkspaceStore((s) => s.current);
  const [plan, setPlan] = useState<WelcomeTourPlan | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  // Load (and re-evaluate on workspace changes)
  useEffect(() => {
    const loaded = loadTourPlan();
    if (!loaded) {
      setPlan(null);
      return;
    }
    // Only show the tour in the workspace it was created for
    if (currentWs && loaded.workspaceId !== currentWs.id) {
      setPlan(null);
      return;
    }
    setPlan(loaded);
    if (!loaded.dismissed && loaded.completed.length === 0) {
      setShowIntro(true);
    }
  }, [currentWs]);

  const persist = (next: WelcomeTourPlan) => {
    saveTourPlan(next);
    setPlan(next);
  };

  const markDone = (id: string) => {
    if (!plan) return;
    if (plan.completed.includes(id)) return;
    persist({ ...plan, completed: [...plan.completed, id] });
  };

  const dismiss = () => {
    if (!plan) return;
    persist({ ...plan, dismissed: true });
    setShowIntro(false);
  };

  const finish = () => {
    clearTourPlan();
    setPlan(null);
    setShowIntro(false);
  };

  const spotlightStops = useMemo<SpotlightStop[]>(() => {
    const stops: SpotlightStop[] = [
      {
        id: "sections",
        selector: '[data-tour="sections"]',
        title: "Your workspace structure",
        body:
          "Pinned items sit at the top, then your clients, projects, and internal work. Pin anything important to keep it one click away.",
        route: { to: "/app" },
        placement: "right",
      },
      {
        id: "create",
        selector: '[data-tour="create"]',
        title: "Create anything from one place",
        body:
          "Use Create to spin up a project, task, client, deal, proposal, page, or note — no matter where you are in the app.",
        route: { to: "/app" },
        placement: "bottom",
      },
      {
        id: "aura-ai",
        selector: '[data-tour="aura-ai"]',
        title: "Meet Aura, your AI copilot",
        body:
          "Aura is page-aware. Open it from anywhere to draft proposals, summarize meetings, write status updates, or answer questions about the data on your current screen.",
        route: { to: "/app" },
        placement: "bottom",
      },
    ];
    if (plan?.has.clients) {
      stops.push({
        id: "clients-header",
        selector: '[data-tour="clients-header"]',
        title: "Clients are your CRM spine",
        body:
          "Every account, contact, deal value, and lifecycle stage lives here. Click an account to see its contacts, deals, projects, and invoices in one view.",
        route: { to: "/app/clients" },
        placement: "bottom",
      });
    }
    if (plan?.primaryProjectId) {
      stops.push({
        id: "project-tabs",
        selector: '[data-tour="project-tabs"]',
        title: "Projects have multiple tabs",
        body:
          "Inside a project, switch between Tasks, Milestones, Documents, Financials, RAID, and more. Only the tabs your project needs are shown — toggle the rest in project settings.",
        route: { to: "/app/p/$projectId", params: { projectId: plan.primaryProjectId } },
        placement: "bottom",
      });
    }
    return stops;
  }, [plan]);

  const launchSpotlight = () => {
    setShowIntro(false);
    setSpotlightOpen(true);
  };

  const steps = useMemo<TourStep[]>(() => {
    if (!plan) return [];
    const allSteps: TourStep[] = [
      {
        id: "spotlight",
        label: "Take a guided feature tour",
        description: "Aura AI, Create, workspace structure, and Clients — highlighted in a few quick stops.",
        icon: Compass,
        cta: "Start tour",
        available: true,
        go: launchSpotlight,
      },
      {
        id: "project",
        label: "Open your first project",
        description: "Create a project when you're ready, then try the kanban and table views.",
        icon: FolderKanban,
        cta: "Open project",
        available: Boolean(plan.primaryProjectId),
        go: () => {
          if (plan.primaryProjectId) {
            navigate({
              to: "/app/p/$projectId",
              params: { projectId: plan.primaryProjectId },
            });
          }
        },
      },
      {
        id: "clients",
        label: "See your client roster",
        description: "Accounts + contacts — the spine of every engagement.",
        icon: Users,
        cta: "View clients",
        available: plan.has.clients,
        go: () => navigate({ to: "/app/clients" }),
      },
      {
        id: "deals",
        label: "Browse your sales pipeline",
        description: "Track deals across stages and drag to move them between columns.",
        icon: TrendingUp,
        cta: "Open pipeline",
        available: plan.has.deals,
        go: () => navigate({ to: "/app/clients" }),
      },
      {
        id: "proposal",
        label: "Review your draft proposal",
        description: "A live proposal tied to a deal — edit, send, or convert to a SOW.",
        icon: FileSignature,
        cta: "View proposals",
        available: plan.has.proposal || plan.has.sow,
        go: () => navigate({ to: "/app/clients", search: { lifecycle: "pre_sales" } }),
      },
      {
        id: "page",
        label: "Read your welcome page",
        description: "Pages are for briefs, meeting notes, and project docs.",
        icon: FileText,
        cta: "Open pages",
        available: plan.has.page,
        go: () => navigate({ to: "/app/pages" }),
      },
      {
        id: "note",
        label: "Check your pinned notes",
        description: "Quick captures that can convert into tasks.",
        icon: StickyNote,
        cta: "View notes",
        available: plan.has.note,
        go: () => navigate({ to: "/app/notes", search: { archived: false, project: undefined } }),
      },
      {
        id: "team",
        label: "Invite your team",
        description: "Bring teammates in — they'll see everything you've set up.",
        icon: UserPlus,
        cta: "Invite",
        available: plan.audience !== "solo",
        go: () => navigate({ to: "/app/settings/members" }),
      },
    ];
    return allSteps.filter((s) => s.available);
  }, [plan, navigate]);

  if (!plan || plan.dismissed) return null;

  const completedCount = plan.completed.length;
  const total = steps.length;
  const allDone = total > 0 && completedCount >= total;
  const copy = AUDIENCE_COPY[plan.audience];

  return (
    <>
      {/* Intro modal */}
      <Dialog
        open={showIntro}
        onOpenChange={(open) => {
          if (!open) setShowIntro(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
          <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl shadow-pop">
              <img src={logoUrl} alt="Aura" className="h-10 w-10 object-contain" />
            </div>
            <DialogTitle className="text-xl">{copy.headline}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {copy.subhead}
            </DialogDescription>
          </DialogHeader>

          {total > 0 && (
            <ul className="mt-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              {steps.slice(0, 5).map((s) => {
                const Icon = s.icon;
                return (
                  <li
                    key={s.id}
                    className="flex items-start gap-2.5 text-sm"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{s.label}</span>
                  </li>
                );
              })}
              {steps.length > 5 && (
                <li className="pl-6 text-xs text-muted-foreground">
                  + {steps.length - 5} more
                </li>
              )}
            </ul>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={dismiss}>
              Skip tour
            </Button>
            <Button
              onClick={() => {
                markDone("spotlight");
                launchSpotlight();
              }}
              className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
            >
              Take the guided tour
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating checklist */}
      {!showIntro && total > 0 && (
        <div className="pointer-events-none fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
          <div
            className="pointer-events-auto w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-pop"
            role="region"
            aria-label="Welcome tour"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
                  <img src={logoUrl} alt="Aura" className="h-6 w-6 object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    Get started
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {completedCount} of {total} done
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setCollapsed((c) => !c)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={collapsed ? "Expand" : "Collapse"}
                >
                  {collapsed ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={dismiss}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Dismiss tour"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className="h-1 bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={completedCount}
            >
              <div
                className="h-full bg-aura-gradient transition-all duration-500"
                style={{
                  width: `${Math.round((completedCount / total) * 100)}%`,
                }}
              />
            </div>

            {!collapsed && (
              <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
                <ul className="space-y-1">
                  {steps.map((s) => {
                    const done = plan.completed.includes(s.id);
                    const Icon = s.icon;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            s.go();
                            markDone(s.id);
                          }}
                          className={`group flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors ${
                            done ? "opacity-60 hover:bg-muted/50" : "hover:bg-muted"
                          }`}
                          aria-label={`${done ? "Visit again" : s.cta}: ${s.label}`}
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              done
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-muted-foreground"
                            }`}
                          >
                            {done ? (
                              <Check className="h-3 w-3" strokeWidth={3} />
                            ) : (
                              <Icon className="h-3 w-3" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-medium leading-tight ${
                                done ? "line-through" : ""
                              }`}
                            >
                              {s.label}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                              {s.description}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-primary group-hover:underline">
                                {done ? "Visit again" : s.cta} →
                              </span>
                              {!done && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markDone(s.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      markDone(s.id);
                                    }
                                  }}
                                  className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                  Mark done
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {allDone && (
                  <div className="mt-2 border-t border-border p-2 pt-3">
                    <p className="mb-2 text-center text-xs text-muted-foreground">
                      Nice work — you've seen the lay of the land.
                    </p>
                    <Button
                      size="sm"
                      onClick={finish}
                      className="w-full bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
                    >
                      Finish tour
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <SpotlightTour
        stops={spotlightStops}
        open={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        onComplete={() => markDone("spotlight")}
      />
    </>
  );
}
