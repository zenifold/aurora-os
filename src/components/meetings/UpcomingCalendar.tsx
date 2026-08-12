import { Link, useNavigate } from "@tanstack/react-router";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { Calendar, Video, Mic, ExternalLink, Users, Plug, Sparkles, Loader2, FileText } from "lucide-react";
import { useUpcomingCalendarEvents, useCreateMeetingFromEvent, type CalendarEvent } from "@/hooks/use-calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  daysAhead?: number;
  onStartRecording?: (event: CalendarEvent) => void;
  compact?: boolean;
}

function dayBucket(d: Date): string {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isThisWeek(d, { weekStartsOn: 1 })) return format(d, "EEEE");
  return format(d, "EEE, MMM d");
}

function conferenceLabel(kind: CalendarEvent["conference_kind"]) {
  switch (kind) {
    case "zoom":
      return "Zoom";
    case "meet":
      return "Google Meet";
    case "teams":
      return "Teams";
    case "webex":
      return "Webex";
    case "other":
      return "Video call";
    default:
      return null;
  }
}

export function UpcomingCalendar({ daysAhead = 14, onStartRecording, compact }: Props) {
  const { data: events = [], isLoading } = useUpcomingCalendarEvents({ daysAhead });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
        <Calendar className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">No upcoming events</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Connect Google Calendar to pull in your meetings automatically.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link to="/app/settings/integrations">
            <Plug className="mr-2 h-3.5 w-3.5" /> Connect calendar
          </Link>
        </Button>
      </div>
    );
  }

  // Group by day
  const grouped = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = dayBucket(new Date(e.start_at));
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([day, items]) => (
        <div key={day}>
          <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {day}
          </h4>
          <div className="space-y-1.5">
            {items.map((e) => (
              <EventRow key={e.id} event={e} onStartRecording={onStartRecording} compact={compact} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventRow({
  event,
  onStartRecording,
  compact,
}: {
  event: CalendarEvent;
  onStartRecording?: (event: CalendarEvent) => void;
  compact?: boolean;
}) {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const confLabel = conferenceLabel(event.conference_kind);
  const attendeeCount = event.attendees?.length ?? 0;

  return (
    <div className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30">
      <div className="flex w-14 shrink-0 flex-col text-xs">
        <span className="font-semibold tabular-nums">{format(start, "HH:mm")}</span>
        <span className="text-muted-foreground tabular-nums">{format(end, "HH:mm")}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-1 text-sm font-medium">{event.title}</p>
          {confLabel && (
            <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
              <Video className="h-3 w-3" /> {confLabel}
            </Badge>
          )}
        </div>
        {!compact && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {attendeeCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {attendeeCount}
              </span>
            )}
            {event.organizer_email && <span className="truncate">{event.organizer_email}</span>}
          </div>
        )}
        <EventActions event={event} onStartRecording={onStartRecording} />
      </div>
    </div>
  );
}

function EventActions({
  event,
  onStartRecording,
}: {
  event: CalendarEvent;
  onStartRecording?: (event: CalendarEvent) => void;
}) {
  const navigate = useNavigate();
  const prepare = useCreateMeetingFromEvent();
  const linked = event.linked_meeting_id;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {event.conference_url && (
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <a href={event.conference_url} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1 h-3 w-3" /> Join
          </a>
        </Button>
      )}
      {linked ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => navigate({ to: "/app/meetings/$meetingId", params: { meetingId: linked } })}
        >
          <FileText className="mr-1 h-3 w-3" /> Open meeting
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={prepare.isPending}
          onClick={async () => {
            const res = await prepare.mutateAsync({ calendar_event_id: event.id });
            navigate({ to: "/app/meetings/$meetingId", params: { meetingId: res.meeting_id } });
          }}
        >
          {prepare.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-3 w-3" />
          )}
          Prepare meeting
        </Button>
      )}
      {event.conference_url && onStartRecording && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => onStartRecording(event)}
        >
          <Mic className="mr-1 h-3 w-3" /> Record
        </Button>
      )}
    </div>
  );
}
