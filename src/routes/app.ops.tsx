import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/ops")({
  component: OpsPage,
});

function OpsPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8">
      <h1 className="bg-aura-gradient bg-clip-text text-2xl font-semibold text-transparent">
        Operations
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Internal PMO, resourcing, and delivery economics.
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Ops command center coming soon — Portfolio · Resources · PMO · Financials.
      </div>
    </div>
  );
}
