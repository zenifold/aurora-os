import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import {
  Palette,
  LayoutDashboard,
  Bell,
  Bot,
  Zap,
  Keyboard,
  User as UserIcon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/app/settings/customization")({
  component: CustomizationPage,
  head: () => ({
    meta: [
      { title: "Customization · Aurora" },
      {
        name: "description",
        content: "Personalize Aurora — theme, density, sidebar, notifications, AI agents.",
      },
    ],
  }),
});

type Tile = {
  title: string;
  desc: string;
  to: string;
  icon: LucideIcon;
};

const TILES: Tile[] = [
  {
    title: "Appearance",
    desc: "Theme, accent color, density, font size, motion.",
    to: "/app/settings/profile",
    icon: Palette,
  },
  {
    title: "Sidebar & layout",
    desc: "Pinned items, collapsed default, density.",
    to: "/app/settings/profile",
    icon: LayoutDashboard,
  },
  {
    title: "Notifications",
    desc: "Inbox rules, mention alerts, agent activity.",
    to: "/app/settings/notifications",
    icon: Bell,
  },
  {
    title: "AI agents",
    desc: "Personas, tools, autonomy, memory.",
    to: "/app/agents",
    icon: Bot,
  },
  {
    title: "Triggers",
    desc: "Schedules and event-driven automations.",
    to: "/app/triggers",
    icon: Zap,
  },
  {
    title: "Profile",
    desc: "Name, avatar, signed-in email.",
    to: "/app/settings/profile",
    icon: UserIcon,
  },
  {
    title: "Keyboard shortcuts",
    desc: "Reference for every page-level shortcut.",
    to: "/app/settings/profile",
    icon: Keyboard,
  },
];

function CustomizationPage() {
  return (
    <div className="animate-page-in flex h-full flex-col">
      <header className="border-b border-border px-6 py-5">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" /> Customization
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything you can change about Aurora — in one place.
          </p>
        </div>
      </header>
      <div className="grid flex-1 gap-3 overflow-auto p-6 sm:grid-cols-2 xl:grid-cols-3">
        {TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.title} to={t.to as never}>
              <Card className="surface-card group h-full p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
                <div className="flex items-start gap-3">
                  <span className="icon-tile">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{t.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
