import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/MarketingChrome";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Aura" },
      {
        name: "description",
        content: "Terms of service for the hosted Aura product. The source code is MIT licensed.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
        <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: May 5, 2026</p>

        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">
          <h2>The deal</h2>
          <p>
            By using the hosted version of Aura, you agree to these terms. The Aura source code
            itself is MIT licensed — see the LICENSE file in the repo for that.
          </p>

          <h2>Your account</h2>
          <p>
            You're responsible for the security of your account, your OpenRouter API key, and
            anything done through your workspace.
          </p>

          <h2>Acceptable use</h2>
          <ul>
            <li>No illegal content or activity.</li>
            <li>No attempting to break, overload, or abuse the service.</li>
            <li>No reselling the hosted service as your own.</li>
          </ul>

          <h2>Billing</h2>
          <p>
            Hosted plans are billed per seat per month. Cancel anytime — access continues until
            the end of the current billing period. AI usage is billed by OpenRouter directly,
            never by us.
          </p>

          <h2>Service availability</h2>
          <p>
            Team plans target 99.9% uptime. We offer service credits for sustained downtime per
            our SLA. The free tier is provided "as is" with no SLA.
          </p>

          <h2>Termination</h2>
          <p>
            You can delete your account anytime. We reserve the right to suspend accounts that
            violate these terms.
          </p>

          <h2>Liability</h2>
          <p>
            Aura is provided as is. To the extent permitted by law, our liability is capped at
            the amount you paid us in the previous 12 months.
          </p>

          <h2>Contact</h2>
          <p>
            Questions? Email <a href="mailto:hello@aura.app" className="underline">hello@aura.app</a>.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
