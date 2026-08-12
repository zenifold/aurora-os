import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, RefreshCw, Unplug, AlertTriangle, Loader2 } from "lucide-react";
import {
  useCalendarConnections,
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
  useSyncGoogleCalendar,
} from "@/hooks/use-calendar";
import { formatDistanceToNow } from "date-fns";

export function GoogleCalendarCard() {
  const { data: connections = [], isLoading } = useCalendarConnections();
  const connect = useConnectGoogleCalendar();
  const sync = useSyncGoogleCalendar();
  const disconnect = useDisconnectGoogleCalendar();

  const google = connections.find((c) => c.provider === "google");
  const isConnected = !!google && google.status === "active";

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-aura-gradient-subtle">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">Google Calendar</h3>
            {isConnected && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            )}
            {google?.status === "error" && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Needs reconnect
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pull upcoming events, detect Zoom / Meet / Teams links, and surface meetings on your dashboard.
          </p>
          {isConnected && (
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {google?.provider_account_email && (
                <div>
                  Account: <span className="font-medium text-foreground">{google.provider_account_email}</span>
                </div>
              )}
              {google?.last_synced_at && (
                <div>
                  Last sync: {formatDistanceToNow(new Date(google.last_synced_at), { addSuffix: true })}
                </div>
              )}
              {google?.last_error && (
                <div className="text-destructive">{google.last_error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : isConnected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              {sync.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              Sync now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              <Unplug className="mr-2 h-3.5 w-3.5" /> Disconnect
            </Button>
          </>
        ) : (
          <Button
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
            className="bg-aura-gradient text-primary-foreground"
            size="sm"
          >
            {connect.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Connect Google Calendar
          </Button>
        )}
      </div>
    </div>
  );
}

export function OutlookCalendarCard() {
  return (
    <div className="rounded-xl border bg-card p-5 opacity-70">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Microsoft Outlook</h3>
            <Badge variant="outline">Coming soon</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Same flow as Google — pulls events and conference links from your Outlook calendar.
          </p>
        </div>
      </div>
    </div>
  );
}
