import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/MarketingChrome";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Aurora" },
      {
        name: "description",
        content:
          "How Aurora handles your data. Self-host for total control, or use our hosted version with strict data minimization.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
        <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: May 5, 2026</p>

        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">
          <h2>The short version</h2>
          <p>
            Aurora is open source. If you self-host, we never see any of your data — full stop. If
            you use the hosted version, we only collect what's strictly necessary to run the
            service and never sell or share your data with third parties.
          </p>

          <h2>What we collect (hosted version)</h2>
          <ul>
            <li>
              <strong>Account info</strong> — email and password hash for authentication.
            </li>
            <li>
              <strong>Workspace data</strong> — projects, tasks, notes, and files you create.
              Stored in our managed database with row-level security.
            </li>
            <li>
              <strong>Usage telemetry</strong> — anonymous, aggregated metrics to improve the
              product (page views, feature usage). No content is logged.
            </li>
          </ul>

          <h2>AI processing</h2>
          <p>
            AI features call OpenRouter using your own API key. Your prompts and content go
            directly to OpenRouter under their privacy terms. We do not store, log, or train on
            your prompts.
          </p>

          <h2>Subprocessors</h2>
          <ul>
            <li>Supabase — database, auth, file storage</li>
            <li>Cloudflare — edge hosting and CDN</li>
            <li>OpenRouter — AI inference (BYO key)</li>
          </ul>

          <h2>Your rights</h2>
          <p>
            You can export or delete your data anytime from{" "}
            <Link to="/app" className="underline">
              Settings → Data
            </Link>
            . Account deletion is permanent and irreversible.
          </p>

          <h2>Contact</h2>
          <p>
            Questions? Email{" "}
            <a href="mailto:hello@aura.app" className="underline">
              hello@aura.app
            </a>{" "}
            or open an issue on GitHub.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
