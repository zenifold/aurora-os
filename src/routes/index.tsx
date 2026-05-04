import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sparkles, Layers, Table as TableIcon, Kanban, Wand2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen aura-mesh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-aura-gradient shadow-pop">
            <Sparkles className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-semibold tracking-tight">Aura</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
            <Link to="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <section className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3" />
            New — Aura v1
          </span>
          <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight md:text-7xl">
            Where <span className="text-aura-gradient">whiteboards</span> meet workflows.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Aura is the project OS for visual thinkers. Plan as a table, work as a board, think as a canvas — same tasks, three minds.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
              <Link to="/signup">Start free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={TableIcon}
            title="Table view"
            body="Spreadsheet speed with custom field types, filters, sorts, and saved views."
          />
          <FeatureCard
            icon={Kanban}
            title="Board view"
            body="Drag tasks across columns. Visual pipeline that stays in sync with everything else."
          />
          <FeatureCard
            icon={Layers}
            title="Canvas view"
            body="Infinite whiteboard for spatial planning. Same tasks, freeform thinking."
          />
        </section>

        <section className="mt-16 rounded-2xl border border-border bg-card/40 p-8 text-center backdrop-blur">
          <Wand2 className="mx-auto h-8 w-8 text-aura-gradient" />
          <h2 className="mt-3 text-2xl font-semibold">One source of truth, every angle.</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Every task is the same task — whether you're scanning a row, dragging a card, or sketching on a canvas.
          </p>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, body }: { icon: typeof Sparkles; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant transition-all hover:shadow-pop">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aura-gradient-subtle">
        <Icon className="h-5 w-5 text-aura-gradient" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
