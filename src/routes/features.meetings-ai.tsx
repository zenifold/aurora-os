import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero, Section, SectionHeader, BulletList, FAQ, CTABand, SplitSection, FeatureGrid, Quote, StatRow } from "@/components/marketing/MarketingPage";
import { Mic, FileText, ListChecks, Sparkles, Search, Lock, Calendar, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/features/meetings-ai")({
  head: () => ({
    meta: [
      { title: "Meetings AI — capture, summarize, act | Aurora" },
      { name: "description", content: "Aurora's Meetings AI records, transcribes and turns every call into structured actions, decisions and CRM updates." },
      { property: "og:title", content: "Aurora — Meetings AI" },
      { property: "og:description", content: "Every meeting becomes structured work." },
    ],
  }),
  component: Page,
});

function MeetingMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-xs font-medium text-muted-foreground">aurora · meeting · Northwind weekly</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> REC 24:18
        </span>
      </div>
      <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 border-r border-border p-5">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Live transcript</div>
            <div className="mt-3 space-y-3 text-sm">
              {[
                { speaker: "Maya R.", color: "from-indigo-500 to-violet-500", text: "We need the hero variants in front of legal by Thursday — otherwise we'll slip the launch window." },
                { speaker: "Daniel O.", color: "from-emerald-500 to-teal-500", text: "Agreed. I'll own the legal handoff. Can we move the CMS migration to next sprint?" },
                { speaker: "Priya S.", color: "from-fuchsia-500 to-pink-500", text: "Yes — that frees up two engineers. I'll update the RAID with the dependency on Northwind's data export." },
              ].map((m) => (
                <div key={m.speaker} className="flex gap-2.5">
                  <span className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gradient-to-br ${m.color} text-[10px] font-semibold text-white`}>{m.speaker.split(" ")[0][0]}{m.speaker.split(" ")[1]?.[0]}</span>
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground">{m.speaker}</div>
                    <p className="leading-relaxed text-foreground/90">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Auto-extracted
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded-md border border-border bg-background/60 p-2.5">
                <div className="text-[10px] font-medium text-violet-500">DECISION</div>
                <div className="mt-0.5 text-xs">Move CMS migration to Sprint 15.</div>
              </div>
              <div className="rounded-md border border-border bg-background/60 p-2.5">
                <div className="text-[10px] font-medium text-amber-500">RISK</div>
                <div className="mt-0.5 text-xs">Northwind data export blocking timeline.</div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Action items</div>
            <div className="mt-3 space-y-1.5">
              {[
                { who: "DO", task: "Send hero variants to legal", due: "Thu" },
                { who: "PS", task: "Update RAID with data dep.", due: "Today" },
                { who: "MR", task: "Re-plan Sprint 15 scope", due: "Mon" },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{a.task}</span>
                  <span className="text-[10px] text-muted-foreground">{a.due}</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-aura-gradient text-[9px] font-semibold text-primary-foreground">{a.who}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Page() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Feature deep dive"
        title="Every meeting becomes structured work"
        subtitle="Join, record, transcribe, summarize and route. Decisions land in the right project, action items in the right person's inbox, notes back in the deal."
        primaryCta={{ label: "Try Aurora", to: "/signup" }}
        secondaryCta={{ label: "See all features", to: "/features" }}
      />
      <Section className="!py-12">
        <MeetingMockup />
      </Section>
      <Section className="!pt-0">
        <StatRow stats={[
          { value: "0", label: "manual notetakers needed" },
          { value: "7s", label: "from end → recap delivered" },
          { value: "8", label: "languages at launch" },
          { value: "100%", label: "owner-linked actions" },
        ]} />
      </Section>
      <Section>
        <SectionHeader eyebrow="Anatomy" title="Six things it does that a transcript can't" />
        <div className="mt-10">
          <FeatureGrid items={[
            { icon: Calendar, title: "Auto-join", description: "Joins Zoom, Meet and Teams without inviting another bot." },
            { icon: Mic, title: "Speaker-aware", description: "Knows who said what, even when people talk over each other." },
            { icon: Sparkles, title: "Structured output", description: "Decisions, risks, action items — extracted, not just summarized." },
            { icon: ListChecks, title: "Owned tasks", description: "Action items become real tasks with the right owner and due date." },
            { icon: FileText, title: "CRM notes", description: "External meetings auto-attach to the right deal or account." },
            { icon: Search, title: "Searchable archive", description: "Find any phrase from any meeting in milliseconds." },
          ]} />
        </div>
      </Section>
      <Section className="!py-12">
        <SplitSection
          left={<SectionHeader align="left" eyebrow="What it does" title="From talking to doing — without the in-between" subtitle="No more chasing a notetaker, sending recaps, or re-typing into Jira." />}
          right={<BulletList items={[
            "Auto-joins Zoom, Google Meet and Teams calls",
            "Speaker-aware transcripts and summaries",
            "Decisions, risks and action items extracted",
            "Action items become tasks owned by real people",
            "CRM notes auto-attached to the right deal",
            "Searchable across every meeting you've ever had",
          ]} />}
        />
      </Section>
      <Section className="!py-12">
        <SplitSection
          reverse
          left={
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3 w-3" /> Privacy by default
              </div>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-2"><Lock className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" /><span>Recordings encrypted at rest in your workspace.</span></li>
                <li className="flex items-start gap-2"><Lock className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" /><span>Retention windows you control (7 / 30 / 90 / 365 days).</span></li>
                <li className="flex items-start gap-2"><Lock className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" /><span>Per-calendar exclusion rules (e.g. 1:1s, HR, board).</span></li>
                <li className="flex items-start gap-2"><Lock className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" /><span>SOC 2 Type II, GDPR-ready, EU data residency.</span></li>
              </ul>
            </div>
          }
          right={<SectionHeader align="left" eyebrow="Privacy" title="The thing your legal team will ask about" subtitle="Meetings AI runs inside Aurora — your data stays in your workspace, never trained on, never sold." />}
        />
      </Section>
      <Section className="!py-12">
        <Quote
          quote="It's the first AI meeting tool that didn't feel like an extra inbox. Recaps just appear, action items already have owners."
          author="Maya Reyes"
          role="COO, Lumen Studios"
        />
      </Section>
      <Section className="!py-12">
        <FAQ items={[
          { q: "What languages are supported?", a: "English, Spanish, French, German, Portuguese, Italian, Dutch and Japanese at launch." },
          { q: "Where are recordings stored?", a: "Encrypted in your Aurora workspace. You set the retention window." },
          { q: "Can I exclude a meeting?", a: "Yes — opt out per-meeting or set rules for sensitive calendars." },
          { q: "Does it work for in-person meetings?", a: "Yes — record from the mobile app or paste a transcript, and the same extraction runs." },
        ]} />
      </Section>
      <CTABand title="Stop taking notes" subtitle="Let the meeting take the notes for you." />
    </MarketingPage>
  );
}
