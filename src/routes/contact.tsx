import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, FeatureGrid } from "@/components/marketing/MarketingPage";
import { MessageSquare, ShieldCheck, Briefcase, LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Aurora — sales, support, security" },
      { name: "description", content: "Get in touch with Aurora's sales, support and security teams." },
      { property: "og:title", content: "Contact Aurora" },
      { property: "og:description", content: "We answer fast." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Contact" title="We answer fast" subtitle="Pick the right inbox and you'll hear back from a real human, usually within the day." />
      <Section>
        <FeatureGrid items={[
          { icon: MessageSquare, title: "Sales", description: "Pricing, plans and demos. Email sales@aurora.app." },
          { icon: LifeBuoy, title: "Support", description: "Existing customers — help@aurora.app or in-app chat." },
          { icon: ShieldCheck, title: "Security", description: "Reports, questionnaires and disclosures — security@aurora.app." },
          { icon: Briefcase, title: "Partnerships", description: "Agencies, integrators and resellers — partners@aurora.app." },
        ]} columns={4} />
      </Section>
    </MarketingPage>
  );
}
