import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, Github, Heart, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_BRAND } from "@/lib/brand";
import logoUrl from "@/assets/logo.png";

export const GITHUB_URL = DEFAULT_BRAND.githubUrl;
const APP_NAME = DEFAULT_BRAND.appName;
const SUPPORT_EMAIL = DEFAULT_BRAND.supportEmail;

export function MarketingHeader() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt={`${APP_NAME} logo`} className="h-8 w-8 rounded-lg shadow-pop" />
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/features" className="text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Features
          </Link>
          <Link to="/use-cases" className="text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Use cases
          </Link>
          <Link to="/how-it-works" className="text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            How it works
          </Link>
          <Link to="/pricing" className="text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Pricing
          </Link>
          <Link to="/extension" className="text-sm text-muted-foreground transition hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
            Extension
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {GITHUB_URL && (
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Github className="h-4 w-4" />
            </a>
          )}
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
    <footer className="relative border-t border-border bg-muted/30">
      <div className="h-px w-full bg-aura-gradient" />
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoUrl} alt={`${APP_NAME} logo`} className="h-8 w-8 rounded-lg shadow-pop" />
              <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The project OS. Tables, boards, canvases, timelines, meetings AI — all
              in one place. Bring your own AI key and pay providers directly.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {GITHUB_URL && (
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-foreground/30 hover:shadow-elegant"
                >
                  <Github className="h-3.5 w-3.5" /> Star on GitHub
                </a>
              )}
              {SUPPORT_EMAIL && (
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  aria-label="Email"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-7 md:grid-cols-3">
            <FooterCol
              title="Product"
              links={[
                { label: "Features", to: "/features" },
                { label: "Use cases", to: "/use-cases" },
                { label: "Chrome extension", to: "/extension" },
                { label: "How it works", to: "/how-it-works" },
                { label: "Pricing", to: "/pricing" },
              ]}

            />
            <FooterCol
              title="Open source"
              mixed={[{ label: "Self-host guide", to: "/docs/self-host" }]}
              external={[
                { label: "GitHub", href: GITHUB_URL },
                { label: "OpenRouter", href: "https://openrouter.ai" },
                { label: "Report an issue", href: `${GITHUB_URL}/issues` },
                { label: "Changelog", href: `${GITHUB_URL}/releases` },
              ]}
            />
            <FooterCol
              title="Company"
              mixed={[
                { label: "Log in", to: "/login" },
                { label: "Sign up", to: "/signup" },
                { label: "Privacy", to: "/privacy" },
                { label: "Terms", to: "/terms" },
              ]}
            />
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5">
            Built with <Heart className="h-3 w-3 fill-rose-500 text-rose-500" /> by{" "}
            <a
              href="https://maxs.page/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              Max
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

type FooterLink = { label: string; to: string };
type ExternalLink = { label: string; href: string };

function FooterCol({
  title,
  links,
  external,
  mixed,
}: {
  title: string;
  links?: FooterLink[];
  external?: ExternalLink[];
  mixed?: FooterLink[];
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
        {title}
      </h4>
      <ul className="mt-4 space-y-2.5">
        {links?.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
        {mixed?.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
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
