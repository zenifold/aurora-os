import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/for/client-services")({
  head: () => ({
    meta: [
      { title: "Aurora for client services — be the prepared one" },
      { name: "description", content: "Every account, every conversation, every ask in one place. Walk into every client call already briefed." },
      { property: "og:title", content: "Aurora for client services" },
      { property: "og:description", content: "Be the calm, prepared face of every account." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="For client services"
        title="Be the calm, prepared face of every account"
        subtitle="One screen per account: open work, open invoices, latest meeting, open risks. Walk into every call already briefed."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "Client portals", to: "/features/client-portals" }}
      />
      <Section>
        <SplitSection
          left={<SectionHeader align="left" eyebrow="What you get" title="The account view your team has been faking" />}
          right={<BulletList items={[
            "Account 360 — projects, deals, invoices, contacts",
            "Last meeting summary + open action items",
            "Client portal activity and unanswered requests",
            "Sentiment and risk flags from meetings + tickets",
            "Renewal dates and upsell hints",
          ]} />}
        />
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Can we score account health?", a: "Yes — out-of-the-box health score, customizable per segment." },
        ]} />
      </Section>
      <CTABand title="Walk into every call ready" />
    </MarketingPage>
  );
}
