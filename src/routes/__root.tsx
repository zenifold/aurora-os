import { Outlet, createRootRouteWithContext, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { DialogsHost } from "@/lib/dialogs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { useUIStore } from "@/stores/ui-store";
import { registerServiceWorker } from "@/lib/pwa";
import { DEFAULT_BRAND } from "@/lib/brand";
import { installGlobalErrorHandlers } from "@/lib/error-reporter";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-aura-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-aura-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-pop transition-opacity hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => {
    const title = `${DEFAULT_BRAND.appName} — ${DEFAULT_BRAND.tagline}`;
    return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0b0b12" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: DEFAULT_BRAND.shortName },
      { title },
      { name: "description", content: DEFAULT_BRAND.description },
      { property: "og:title", content: title },
      { property: "og:description", content: DEFAULT_BRAND.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: DEFAULT_BRAND.description },
      { title: "Aurora" },
      { property: "og:title", content: "Aurora" },
      { name: "twitter:title", content: "Aurora" },
      { name: "description", content: "Productivity reimagined" },
      { property: "og:description", content: "Productivity reimagined" },
      { name: "twitter:description", content: "Productivity reimagined" },
      { property: "og:image", content: "/icon-512.png" },
      { name: "twitter:image", content: "/icon-512.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "icon", type: "image/png", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
      },
    ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Inline script avoids a flash of light theme on first paint.
  // Defaults to dark; respects an explicit user override in localStorage.
  const themeBoot = `(function(){try{var t=localStorage.getItem('aura-theme');var d=t==='light'?false:(t==='dark'||!t?true:matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`;
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ThemeBootstrap() {
  const resolvedTheme = useUIStore((s) => s.resolvedTheme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);
  useEffect(() => {
    registerServiceWorker();
    installGlobalErrorHandlers();
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={200}>
          <ThemeBootstrap />
          <Outlet />
          <Toaster />
          <DialogsHost />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
