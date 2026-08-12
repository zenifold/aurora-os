import { createFileRoute } from "@tanstack/react-router";
import {
  MarketingPage,
  PageHero,
  Section,
  SectionHeader,
  FeatureGrid,
  CTABand,
  FAQ,
  SplitSection,
  BulletList,
} from "@/components/marketing/MarketingPage";
import { Button } from "@/components/ui/button";
import {
  Chrome,
  Command,
  Camera,
  Search,
  LayoutDashboard,
  Mic,
  Wand2,
  Download,
  Shield,
  Keyboard,
  Globe2,
} from "lucide-react";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/extension")({
  head: () => ({
    meta: [
      { title: "Aurora Chrome extension — your workspace, in every tab" },
      {
        name: "description",
        content:
          "Capture tasks and screenshots from any page, run AI on a selection, search your workspace from the URL bar, and replace your new-tab with an Aurora dashboard.",
      },
      { property: "og:title", content: "Aurora — Chrome companion" },
      {
        property: "og:description",
        content:
          "Quick capture, omnibox search, Context Lens AI and a new-tab dashboard. Free for every plan.",
      },
    ],
  }),
  component: ExtensionPage,
});

const COMMANDS = [
  { icon: Command, title: "Quick capture", description: "⌘+Shift+A from any tab. Type a task, hit enter, it lands in the right project with the page URL attached." },
  { icon: Search, title: "Omnibox search", description: "Type 'aura' in the URL bar to search projects, docs, deals and people without leaving the page." },
  { icon: Wand2, title: "Context Lens", description: "Select any text and run an agent — summarize, turn into a task, draft a reply, file as a meeting note." },
  { icon: Camera, title: "Annotated screenshots", description: "One-click capture, mark up, and ship as a bug or task into the right project." },
  { icon: LayoutDashboard, title: "New-tab dashboard", description: "Replace the empty new-tab page with your inbox, today's meetings and what's due." },
  { icon: Mic, title: "Meeting auto-capture", description: "Detects calls in Google Meet, Zoom and Teams. Joins, transcribes, summarizes — automatically." },
];


function ExtensionPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Chrome companion"
        title={<>Your workspace, in <span className="text-aura-gradient">every tab</span></>}
        subtitle="The Aurora Chrome extension makes the browser feel like part of your workspace. Capture, search and ask AI without leaving the page you're on."
      />

      {/* Browser mock + Download CTA */}
      <Section className="!py-10">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <div className="ml-3 flex flex-1 items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                <Search className="h-3 w-3" /> aura ship pricing teardown to halfmast launch
              </div>
              <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-aura-gradient text-primary-foreground shadow-pop">
                <img src={logoUrl} alt="Aurora" className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="grid grid-cols-12">
              {/* fake page */}
              <div className="col-span-12 border-r border-border p-8 md:col-span-8">
                <div className="space-y-2">
                  <div className="h-3 w-40 rounded bg-muted" />
                  <div className="h-6 w-3/4 rounded bg-muted" />
                  <div className="mt-4 h-2 w-full rounded bg-muted/70" />
                  <div className="h-2 w-11/12 rounded bg-muted/70" />
                  <div className="h-2 w-10/12 rounded bg-muted/70" />
                </div>
                <div className="relative mt-6 rounded-md border-2 border-dashed border-foreground/40 bg-aura-gradient/[0.08] p-4 text-sm">
                  <span className="absolute -top-2 left-3 rounded bg-background px-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Selected
                  </span>
                  Acme charges $99/seat including AI. Margins are eaten by token overage on heavy users.
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["Summarize", "Make task", "Draft reply", "Add to deal"].map((a, i) => (
                      <span key={a} className={`rounded-md px-2.5 py-1 text-xs ${i === 1 ? "bg-aura-gradient text-primary-foreground shadow-pop" : "border border-border bg-card text-muted-foreground"}`}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {/* sidebar lens */}
              <aside className="col-span-12 bg-muted/30 p-5 md:col-span-4">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  <Wand2 className="h-3 w-3" /> Context Lens
                </div>
                <div className="mt-3 rounded-lg border border-border bg-card p-3 text-xs">
                  <div className="font-medium">Summary</div>
                  <p className="mt-1.5 text-muted-foreground">Competitor uses bundled-AI pricing but burns margin on heavy users. Possible angle: token-transparent pricing.</p>
                </div>
                <div className="mt-3 rounded-lg border border-border bg-card p-3 text-xs">
                  <div className="font-medium">New task</div>
                  <div className="mt-1.5 text-muted-foreground">Ship pricing teardown · #halfmast-launch · @maya · due Fri</div>
                  <div className="mt-3 flex justify-end">
                    <span className="rounded-md bg-aura-gradient px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-pop">
                      Capture ⌘↵
                    </span>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3">
            <DownloadButton />
            <p className="text-xs text-muted-foreground">
              Free, open-source, works on Chrome, Edge, Brave, Arc and Opera.
            </p>
          </div>
        </div>
      </Section>

      {/* Commands grid */}
      <Section className="!py-16">
        <SectionHeader eyebrow="What it does" title="Six things you'll use every day" />
        <div className="mt-12">
          <FeatureGrid items={COMMANDS} columns={3} />
        </div>
      </Section>

      {/* Install steps */}
      <Section className="!py-14">
        <SectionHeader eyebrow="Install" title="Four steps. About 30 seconds." />
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-4">
          {[
            { n: 1, title: "Download", body: "Grab the latest build below — it's a single .zip." },
            { n: 2, title: "Unzip", body: "Extract it somewhere you won't accidentally delete." },
            { n: 3, title: "chrome://extensions", body: "Enable Developer mode in the top-right." },
            { n: 4, title: "Load unpacked", body: "Pick the unzipped folder. You're in." },
          ].map((s) => (
            <div key={s.n} className="relative rounded-xl border border-border bg-card p-5">
              <div className="absolute -top-3 left-5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-aura-gradient text-xs font-bold text-primary-foreground shadow-pop">
                {s.n}
              </div>
              <h3 className="mt-1 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <DownloadButton />
        </div>
      </Section>

      {/* Shortcuts + security */}
      <Section className="!py-16">
        <SplitSection
          left={
            <div>
              <SectionHeader align="left" eyebrow="Keyboard" title="The shortcuts you'll memorize" subtitle="Every Aurora action you reach for is one keystroke away." />
              <div className="mt-6 space-y-3">
                {[
                  { keys: "⌘ Shift A", body: "Open Quick Capture from any tab" },
                  { keys: "⌘ Shift L", body: "Toggle Context Lens sidebar" },
                  { keys: "aura …", body: "Search your workspace from the URL bar" },
                  { keys: "⌘ ↵", body: "Confirm and capture" },
                ].map((s) => (
                  <div key={s.keys} className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3">
                    <span className="text-sm text-muted-foreground">{s.body}</span>
                    <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          }
          right={
            <div>
              <SectionHeader align="left" eyebrow="Permissions" title="What it touches, and what it doesn't" />
              <BulletList items={[
                "Only sends page data when you trigger an action",
                "Selections never leave your browser without consent",
                "All requests scoped to your workspace, with audit log",
                "No tracking, no analytics on page content",
                "Open source — read the manifest on GitHub",
              ]} />
              <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                Manifest V3 · scoped host permissions
              </div>
            </div>
          }
        />
      </Section>

      {/* FAQ */}
      <Section className="!py-14">
        <SectionHeader title="Frequently asked" />
        <div className="mt-8">
          <FAQ items={[
            { q: "Which browsers does it support?", a: "Anything Chromium: Chrome, Edge, Brave, Arc, Opera and Vivaldi." },
            { q: "Is it on the Chrome Web Store?", a: "Web Store version is in review. Install unpacked today — same code, no waiting." },
            { q: "Do I need a paid Aurora plan?", a: "No. The extension is free for every workspace, including the free tier." },
            { q: "Can I customize the new-tab dashboard?", a: "Yes — pin any saved view, agent or report, drag to rearrange." },
            { q: "Does Context Lens cost extra tokens?", a: "It uses your workspace's AI key — same OpenRouter setup as the rest of Aurora." },
          ]} />
        </div>
      </Section>

      <CTABand
        title="Make every tab work for you"
        subtitle="Install the Aurora extension and bring your workspace along."
        secondaryCta={{ label: "See all features", to: "/features" }}
      />
    </MarketingPage>
  );
}

function DownloadButton() {
  const handleDownload = () => {
    fetch("/aura-extension.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "aura-extension.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };
  return (
    <Button
      onClick={handleDownload}
      size="lg"
      className="bg-aura-gradient text-primary-foreground shadow-pop hover:opacity-90"
    >
      <Download className="mr-2 h-4 w-4" /> Download for Chrome
    </Button>
  );
}

// re-exports to satisfy bundler if anything is tree-shaken; harmless
void [Keyboard, Globe2, Chrome];
