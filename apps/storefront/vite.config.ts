import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../..", import.meta.url));

// `@funky/ui` is a real pnpm workspace package now (see ../../pnpm-workspace.yaml),
// symlinked into node_modules with its peerDependencies (react, react-router-dom,
// lucide-react, react-helmet-async) resolved against this app's copies — no manual
// aliasing needed for it to share a single instance of those libraries.
export default defineConfig({
  define: {
    "import.meta.env.STOREFRONT_EXPECTED_LOCALES": JSON.stringify(
      process.env.STOREFRONT_EXPECTED_LOCALES || "",
    ),
  },
  plugins: [react()],
  build: {
    manifest: true,
    sourcemap: true,
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    fs: {
      allow: [frontendRoot],
    },
  },
});
