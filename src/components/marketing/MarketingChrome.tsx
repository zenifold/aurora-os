import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, ArrowRight, Github } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const GITHUB_URL = "https://github.com/aura-os/aura";

export function MarketingHeader() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aura-gradient shadow-pop">
            <Sparkles className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold tracking-tight">Aura</span>
          <span className="ml-1 hidden rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground sm:inline">
            open source
          </span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/features" className="text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Features
          </Link>
          <Link to="/how-it-works" className="text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            How it works
          </Link>
          <Link to="/pricing" className="text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Pricing
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
              <Link to="/app">
                Go to app <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
                <Link to="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="h-px w-full bg-aura-gradient" />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-aura-gradient">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Aura</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            The open-source project OS. Bring your own AI.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-foreground/30"
          >
            <Github className="h-3.5 w-3.5" /> Star on GitHub
          </a>
        </div>
        <FooterCol
          title="Product"
          links={[
            { label: "Features", to: "/features" },
            { label: "How it works", to: "/how-it-works" },
            { label: "Pricing", to: "/pricing" },
          ]}
        />
        <FooterCol
          title="Open source"
          external={[
            { label: "GitHub", href: GITHUB_URL },
            { label: "Self-host guide", href: `${GITHUB_URL}#self-hosting` },
            { label: "OpenRouter", href: "https://openrouter.ai" },
            { label: "Report an issue", href: `${GITHUB_URL}/issues` },
          ]}
        />
        <FooterCol
          title="Account"
          links={[
            { label: "Log in", to: "/login" },
            { label: "Sign up", to: "/signup" },
          ]}
        />
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Aura · MIT licensed · Built for people, not pricing pages.
      </div>
    </footer>
  );
}

type FooterLink = { label: string; to: "/features" | "/how-it-works" | "/pricing" | "/login" | "/signup" };
type ExternalLink = { label: string; href: string };

function FooterCol({
  title,
  links,
  external,
}: {
  title: string;
  links?: FooterLink[];
  external?: ExternalLink[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-3 space-y-2">
        {links?.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="text-sm text-muted-foreground transition hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
        {external?.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
