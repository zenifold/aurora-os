import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Self-owned Vite config. This replaces @lovable.dev/vite-tanstack-config,
// which used to supply every plugin below implicitly. Nothing here is magic —
// add or reorder plugins as the project needs.
export default defineConfig(({ command, mode }) => {
  // The SSR/worker bundle has no process.env at runtime, so VITE_* vars are
  // inlined at build time. Vite does this for client code automatically; doing
  // it explicitly keeps server-rendered code working the same way.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // Cloudflare's plugin only participates in builds; loading it in dev
    // fights Vite's own dev server.
    ...(command === "build" ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
    tanstackStart({
      // Guard against server code leaking into the browser bundle.
      //
      // The Lovable config banned the whole `**/server/**` directory from the
      // client graph, which is incompatible with this project's layout: 51
      // route/component files import `createServerFn` handlers out of
      // src/server/*.functions.ts, and that RPC boundary is exactly what
      // TanStack Start is designed to bundle safely. With that pattern in
      // place `vite build` could never succeed. Only the `server-only`
      // specifier is a real signal, so that is what we enforce.
      importProtection: {
        behavior: "error",
        client: {
          specifiers: ["server-only"],
        },
      },
    }),
    viteReact(),
  ];

  return {
    define: envDefine,
    plugins,
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      // Multiple copies of React or TanStack Query break hooks and cache
      // identity, which is easy to reintroduce via transitive deps.
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      // 8080 collides with other local projects; fail loudly rather than
      // silently drifting to 8081 and serving a different app on 8080.
      port: Number(process.env.PORT) || 5173,
      strictPort: true,
      watch: {
        // Debounce noisy editors/formatters writing partial files.
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
      },
    },
  };
});
