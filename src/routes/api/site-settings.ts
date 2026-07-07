import { createFileRoute } from "@tanstack/react-router";
import { readSiteSettings } from "@/lib/site-settings.server";

export const Route = createFileRoute("/api/site-settings")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json({ settings: await readSiteSettings() });
        } catch (error) {
          console.error("[api/site-settings] 读取失败:", error);
          return Response.json({ settings: await readSiteSettings(), warning: "using-defaults" });
        }
      },
    },
  },
});
