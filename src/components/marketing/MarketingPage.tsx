import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/MarketingChrome";
import { ArrowRight, Check, X, type LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Page shell                                                          */
/* ------------------------------------------------------------------ */

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export function PageHero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  primaryCta?: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/40">
      <div className="absolute inset-0 bg-aura-gradient opacity-[0.07]" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
        {eyebrow && (
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            {subtitle}
          </p>
        )}
        {(primaryCta || secondaryCta) && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {primaryCta && (
              <Button asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
                <Link to={primaryCta.to}>
                  {primaryCta.label} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
            {secondaryCta && (
              <Button asChild variant="outline">
                <Link to={secondaryCta.to}>{secondaryCta.label}</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section header                                                      */
/* ------------------------------------------------------------------ */

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
}) {
  const isCenter = align === "center";
  return (
    <div className={isCenter ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {subtitle && (
        <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feature grid                                                        */
/* ------------------------------------------------------------------ */

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
  to?: string;
}

export function FeatureGrid({ items, columns = 3 }: { items: FeatureItem[]; columns?: 2 | 3 | 4 }) {
  const cols =
    columns === 4
      ? "md:grid-cols-2 lg:grid-cols-4"
      : columns === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-5 ${cols}`}>
      {items.map((f) => {
        const card = (
          <div className="group flex h-full cursor-pointer flex-col rounded-xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-elegant">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-aura-gradient text-primary-foreground shadow-pop">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            {f.to && (
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-foreground/80 transition group-hover:gap-2 group-hover:text-foreground">
                Learn more <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        );
        return f.to ? (
          <Link key={f.title} to={f.to} className="block">
            {card}
          </Link>
        ) : (
          <div key={f.title}>{card}</div>
        );
      })}
    </div>

  );
}

/* ------------------------------------------------------------------ */
/* Bullet list                                                         */
/* ------------------------------------------------------------------ */

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
          <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-aura-gradient text-primary-foreground">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className="text-foreground/90">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Two-column split                                                    */
/* ------------------------------------------------------------------ */

export function SplitSection({
  left,
  right,
  reverse = false,
}: {
  left: ReactNode;
  right: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comparison table                                                    */
/* ------------------------------------------------------------------ */

export interface ComparisonRow {
  label: string;
  aurora: boolean | string;
  other: boolean | string;
}

export function ComparisonTable({
  otherName,
  rows,
}: {
  otherName: string;
  rows: ComparisonRow[];
}) {
  const renderCell = (v: boolean | string) => {
    if (typeof v === "boolean") {
      return v ? (
        <Check className="mx-auto h-4 w-4 text-emerald-500" strokeWidth={3} />
      ) : (
        <X className="mx-auto h-4 w-4 text-muted-foreground/60" strokeWidth={3} />
      );
    }
    return <span className="text-sm text-foreground/90">{v}</span>;
  };
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-5 py-3 text-left">Capability</th>
            <th className="px-5 py-3 text-center">Aurora</th>
            <th className="px-5 py-3 text-center">{otherName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={i % 2 === 0 ? "bg-background/40" : ""}>
              <td className="px-5 py-3.5 text-sm font-medium">{r.label}</td>
              <td className="px-5 py-3.5 text-center">{renderCell(r.aurora)}</td>
              <td className="px-5 py-3.5 text-center">{renderCell(r.other)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export function FAQ({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border rounded-xl border border-border bg-card">
      {items.map((it) => (
        <details key={it.q} className="group p-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-medium">
            <span>{it.q}</span>
            <span className="mt-1 text-muted-foreground transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quote / testimonial slot                                            */
/* ------------------------------------------------------------------ */

export function Quote({
  quote,
  author,
  role,
}: {
  quote: string;
  author: string;
  role: string;
}) {
  return (
    <figure className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
      <blockquote className="text-balance text-xl font-medium leading-relaxed tracking-tight md:text-2xl">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{author}</span> · {role}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* CTA band                                                            */
/* ------------------------------------------------------------------ */

export function CTABand({
  title,
  subtitle,
  primaryCta = { label: "Get started free", to: "/signup" },
  secondaryCta,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  primaryCta?: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
}) {
  return (
    <section className="border-y border-border bg-muted/30 py-16">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
        {subtitle && (
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90">
            <Link to={primaryCta.to}>
              {primaryCta.label} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          {secondaryCta && (
            <Button asChild variant="outline">
              <Link to={secondaryCta.to}>{secondaryCta.label}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section wrapper                                                     */
/* ------------------------------------------------------------------ */

export function Section({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto max-w-6xl px-6 py-20 ${className}`}>{children}</section>
  );
}

/* ------------------------------------------------------------------ */
/* Stat row                                                            */
/* ------------------------------------------------------------------ */

export function StatRow({ stats }: { stats: Array<{ value: string; label: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-6 rounded-xl border border-border bg-card p-8 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <div className="bg-aura-gradient bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
            {s.value}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
