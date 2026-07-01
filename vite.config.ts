import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Standard TanStack Start + Vite setup (lovable wrapper removed).
//   - tanstackStart: file-based routing, SSR
//   - nitro:         server build → .output/ (preset via NITRO_PRESET env,
//                    Dockerfile sets node-server for NAS / Docker)
//   - viteReact:     JSX / Fast Refresh (must come AFTER tanstackStart)
//   - tailwindcss:   TailwindCSS v4 Vite plugin
//   - tsConfigPaths: resolves the "@/*" -> "./src/*" alias from tsconfig.json
export default defineConfig({
  plugins: [
    tanstackStart({
      // Custom SSR entry that wraps the generated server-entry with error handling.
      server: { entry: "src/server.ts" },
    }),
    nitro(),
    viteReact(),
    tailwindcss(),
    tsConfigPaths(),
  ],
  resolve: {
    // Avoid duplicate React copies in the bundle.
    dedupe: ["react", "react-dom"],
  },
});
