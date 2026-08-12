import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { GoogleCalendarCard, OutlookCalendarCard } from "@/components/integrations/GoogleCalendarCard";

type Search = { connected?: string; error?: string };

export const Route = createFileRoute("/app/settings/integrations")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    connected: typeof s.connected === "string" ? s.connected : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { connected, error } = Route.useSearch();
  const router = useRouter();

  useEffect(() => {
    if (connected) {
      toast.success(`${cap(connected)} connected`);
      router.navigate({ to: "/app/settings/integrations", search: {} });
    } else if (error) {
      toast.error(`Calendar connection failed: ${error}`);
      router.navigate({ to: "/app/settings/integrations", search: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, error]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Calendar integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect your calendar so meetings show up in the app automatically.
          Zoom, Google Meet and Microsoft Teams links inside calendar events are detected
          so you can join and start recording in one click.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <GoogleCalendarCard />
        <OutlookCalendarCard />
      </div>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
