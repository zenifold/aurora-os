import { useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpen,
  Database,
  Keyboard,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { resolveHelp } from "@/lib/help-registry";

export function HelpPanel() {
  const open = useUIStore((s) => s.helpOpen);
  const setOpen = useUIStore((s) => s.setHelpOpen);
  const markSeen = useUIStore((s) => s.markHelpSeen);
  const setQuickCreateOpen = useUIStore((s) => s.setQuickCreateOpen);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const entry = resolveHelp(path);
  const Icon = entry.icon;

  useEffect(() => {
    if (open) markSeen(entry.id);
  }, [open, entry.id, markSeen]);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="border-b border-border bg-muted/30 px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-aura-gradient text-primary-foreground">
              <Icon className="h-3.5 w-3.5" />
            </span>
            {entry.title}
            <Badge variant="outline" className="ml-1 text-[10px]">
              Page help
            </Badge>
          </SheetTitle>
          <SheetDescription className="text-xs leading-relaxed">
            {entry.summary}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-5 py-5 text-sm">
          {entry.tryIt && entry.tryIt.length > 0 && (
            <Section icon={Sparkles} title="Try it">
              <div className="flex flex-wrap gap-2">
                {entry.tryIt.map((a) => (
                  <Button
                    key={a.label}
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (a.intent === "quickCreate") {
                        close();
                        setQuickCreateOpen(true);
                      } else if (a.intent === "command") {
                        close();
                        setCommandOpen(true);
                      } else if (a.to) {
                        close();
                        navigate({ to: a.to as never });
                      }
                    }}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {a.label}
                  </Button>
                ))}
              </div>
            </Section>
          )}

          <Section icon={BookOpen} title="What you can do here">
            <ul className="space-y-1.5">
              {entry.capabilities.map((c) => (
                <li key={c} className="flex gap-2 text-muted-foreground">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span className="leading-relaxed text-foreground/90">{c}</span>
                </li>
              ))}
            </ul>
          </Section>

          {entry.customize.length > 0 && (
            <Section icon={Sparkles} title="What you can customize">
              <div className="flex flex-wrap gap-1.5">
                {entry.customize.map((c) => (
                  <Link
                    key={c.to}
                    to={c.to as never}
                    onClick={close}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                  >
                    {c.label}
                    <ArrowRight className="h-3 w-3 opacity-60" />
                  </Link>
                ))}
              </div>
            </Section>
          )}

          <Section icon={Database} title="Where this is stored">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {entry.storage}
            </p>
          </Section>

          {entry.shortcuts.length > 0 && (
            <Section icon={Keyboard} title="Keyboard shortcuts">
              <ul className="space-y-1.5">
                {entry.shortcuts.map((s) => (
                  <li
                    key={s.keys}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-muted-foreground">{s.desc}</span>
                    <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium">
                      {s.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {entry.walkthrough && entry.walkthrough.length > 0 && (
            <Section icon={BookOpen} title="30-second walkthrough">
              <ol className="space-y-2">
                {entry.walkthrough.map((step, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed text-foreground/90">{step}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <div className="rounded-md border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            Press <kbd className="rounded border bg-background px-1 font-mono">?</kbd> from any page to reopen page-aware help.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </h3>
      {children}
    </section>
  );
}
