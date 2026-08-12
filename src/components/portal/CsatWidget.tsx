import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  token: string;
  milestoneId?: string | null;
  statusUpdateId?: string | null;
  title?: string;
  subtitle?: string;
}

export function CsatWidget({
  token,
  milestoneId,
  statusUpdateId,
  title = "How are we doing?",
  subtitle = "Your rating helps the team improve delivery.",
}: Props) {
  const [score, setScore] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!score) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/portal/${token}/csat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          comment: comment.trim() || null,
          milestone_id: milestoneId ?? null,
          status_update_id: statusUpdateId ?? null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
      toast.success("Thanks for your feedback!");
    } catch (e) {
      toast.error((e as Error).message || "Could not submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Card className="flex items-center gap-3 p-5 text-sm">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        Thanks — your feedback has been shared with the project team.
      </Card>
    );
  }

  const active = hover ?? score ?? 0;

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onClick={() => setScore(n)}
            aria-label={`Rate ${n} of 5`}
            className="rounded-md p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`h-7 w-7 ${
                n <= active
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
      </div>
      {score !== null && (
        <>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What's working well? What could be better? (optional)"
            rows={3}
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={submitting}>
              {submitting ? "Sending…" : "Send feedback"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
