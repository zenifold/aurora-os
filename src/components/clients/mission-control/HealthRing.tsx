import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Breakdown = {
  delivery: number;
  commercial: number;
  engagement: number;
  documents: number;
};

export function HealthRing({
  score,
  size = 56,
  breakdown,
  label = "Health",
}: {
  score: number | null | undefined;
  size?: number;
  breakdown?: Breakdown;
  label?: string;
}) {
  const value = Math.max(0, Math.min(100, score ?? 0));
  const radius = (size - 6) / 2;
  const circ = 2 * Math.PI * radius;
  const dash = (value / 100) * circ;
  const color =
    value >= 75 ? "var(--success, hsl(142 76% 36%))" :
    value >= 50 ? "var(--warning, hsl(38 92% 50%))" :
    "var(--destructive)";

  const ring = (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))" strokeWidth="4" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold leading-none">{score == null ? "—" : value}</span>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</span>
      </div>
    </div>
  );

  if (!breakdown) return ring;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{ring}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="font-medium mb-1">Health breakdown</div>
          <div>Delivery: {breakdown.delivery}</div>
          <div>Commercial: {breakdown.commercial}</div>
          <div>Engagement: {breakdown.engagement}</div>
          <div>Documents: {breakdown.documents}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
