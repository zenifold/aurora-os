import { useRouter, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { reportError } from "@/lib/error-reporter";

export function RouteErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    void reportError(error, { context: { type: "route-boundary" } });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Something went wrong on this page</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-aura-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-pop hover:opacity-90"
          >
            Try again
          </button>
          <Link
            to="/app"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to app
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RouteNotFound({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">{label ?? "Not found"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The resource you're looking for doesn't exist.
        </p>
        <Link
          to="/app"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-aura-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-pop hover:opacity-90"
        >
          Back to app
        </Link>
      </div>
    </div>
  );
}
