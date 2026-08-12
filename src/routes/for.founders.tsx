import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection, Quote } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/for/founders")({
  head: () => ({
    meta: [
      { title: "Aurora for founders — see sales, delivery & cash" },
      { name: "description", content: "One screen for pipeline, project health, cash and team load. Stop stitching five dashboards together." },
      { property: "og:title", content: "Aurora for founders" },
      { property: "og:description", content: "Run the company from one screen." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="For founders"
        title="Run the company from one screen"
        subtitle="Stop stitching together CRM, project tool, accounting and a HR sheet. Aurora gives you sales, delivery, cash and team load in one place — without a BI project."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "Talk to founders", to: "/contact" }}
      />
      <Section>
        <SplitSection
          left={<SectionHeader align="left" eyebrow="What you get" title="The picture you used to ask three people for" />}
          right={<BulletList items={[
            "Pipeline, forecast and won-this-month at a glance",
            "Project health across every active engagement",
            "Cash in, cash out, runway and AR aging",
            "Team utilization, who's overloaded, who's free",
            "Risk surface — overdue invoices, slipping projects, cold deals",
          ]} />}
        />
      </Section>
      <Section>
        <Quote quote="I stopped opening Notion, HubSpot, ClickUp and Xero. I just open Aurora." author="Maya Reyes" role="Founder, Northwind Studio" />
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Is this overkill for a 5-person team?", a: "No — Aurora scales down. You can turn off modules you don't need." },
          { q: "Can my accountant access it?", a: "Yes, with a finance-scoped guest role." },
        ]} />
      </Section>
      <CTABand title="Stop tab-hopping" />
    </MarketingPage>
  );
}
