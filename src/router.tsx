import { createRouter, useRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-aura-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-pop hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 1000 * 60 * 60 * 24, // 24h — keep cache for offline restore
        refetchOnWindowFocus: false,
      },
    },
  });

  // Persist query cache to localStorage for offline support (browser only)
  if (typeof window !== "undefined") {
    Promise.all([
      import("@tanstack/react-query-persist-client"),
      import("@tanstack/query-sync-storage-persister"),
    ])
      .then(([{ persistQueryClient }, { createSyncStoragePersister }]) => {
        const persister = createSyncStoragePersister({
          storage: window.localStorage,
          key: "aura-query-cache",
          throttleTime: 1000,
        });
        persistQueryClient({
          queryClient: queryClient as any,
          persister,
          maxAge: 1000 * 60 * 60 * 24, // 24h
        });
      })
      .catch(() => {});
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });
  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
