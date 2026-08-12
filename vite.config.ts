import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Modules that only ever run in the browser. Excalidraw drags in a large
// transitive graph — mermaid (via @excalidraw/mermaid-to-excalidraw), cytoscape,
// katex, font subsetting — worth ~2.4 MiB gzipped. Vite emits those chunks into
// the SSR build even though they are behind dynamic imports, and the Cloudflare
// Workers free plan caps a script at 3 MiB, which put the whole deploy over.
//
// Stubbing them in the SSR graph keeps them out of dist/server. Anything that
// renders them server-side now throws a named error instead of silently
// bloating the bundle, so the client-only gate in CanvasEditor is load-bearing.
const CLIENT_ONLY_IN_SSR = [
  "@excalidraw/excalidraw",
  "@excalidraw/mermaid-to-excalidraw",
  "mermaid",
  "cytoscape",
  "katex",
];

function stubClientOnlyInSsr(): PluginOption {
  const PREFIX = "\0client-only-stub:";
  return {
    name: "stub-client-only-in-ssr",
    enforce: "pre",
    resolveId(id, _importer, options) {
      if (!options?.ssr) return null;
      // Stylesheets are not uploaded to the Worker, so leave them resolvable.
      if (id.endsWith(".css")) return null;
      const match = CLIENT_ONLY_IN_SSR.some((m) => id === m || id.startsWith(`${m}/`));
      return match ? PREFIX + id : null;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const name = id.slice(PREFIX.length);
      const message =
        `${name} is client-only and was stubbed out of the server bundle. ` +
        `Something rendered it during SSR — gate it behind a mounted check.`;
      return [
        `const message = ${JSON.stringify(message)};`,
        `export default new Proxy(`,
        `  {},`,
        `  {`,
        `    get(_target, prop) {`,
        `      if (prop === "__esModule") return true;`,
        `      throw new Error(message);`,
        `    },`,
        `  },`,
        `);`,
      ].join("\n");
    },
  };
}

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
    stubClientOnlyInSsr(),
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
