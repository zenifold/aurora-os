import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection } from "@/components/marketing/MarketingPage";

export const Route = createFileRoute("/features/permissions-rbac")({
  head: () => ({
    meta: [
      { title: "Permissions & RBAC — enterprise-grade access | Aurora" },
      { name: "description", content: "Roles, custom roles, scoped sharing, audit log and SSO. Aurora's permission model is built for regulated and multi-client teams." },
      { property: "og:title", content: "Aurora permissions & RBAC" },
      { property: "og:description", content: "Access control that scales with you." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Feature deep dive"
        title="Permissions that scale with you"
        subtitle="Owner, admin, member, guest — plus custom roles, field-level controls, share links and a full audit trail. No more spreadsheet of who-can-see-what."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "Security overview", to: "/security" }}
      />
      <Section>
        <SplitSection
          left={<SectionHeader align="left" eyebrow="Built in" title="A real RBAC model, not a toggle wall" />}
          right={<BulletList items={[
            "Built-in roles + unlimited custom roles",
            "Per-workspace, per-project, per-record overrides",
            "Time-bound and expiring share links",
            "SSO via Google, Microsoft and SAML",
            "SCIM provisioning on enterprise plans",
            "Tamper-evident audit log, exportable",
          ]} />}
        />
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "Is there field-level permission?", a: "Yes — hide or read-only specific fields per role." },
          { q: "Can guests be free?", a: "Read-only guests are free. Active guests bill at a guest rate." },
          { q: "Do you support SAML SSO?", a: "Yes — Okta, Azure AD, Google Workspace and generic SAML 2.0." },
        ]} />
      </Section>
      <CTABand title="Security that doesn't get in the way" />
    </MarketingPage>
  );
}
