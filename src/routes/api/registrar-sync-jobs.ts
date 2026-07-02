import { createFileRoute } from "@tanstack/react-router";
import { jsonError, requireApiAdmin } from "@/lib/api-auth.server";
import { listRegistrarSyncJobs } from "@/lib/registrar-domains.server";

export const Route = createFileRoute("/api/registrar-sync-jobs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = await requireApiAdmin(request);
          const url = new URL(request.url);
          const limit = Number(url.searchParams.get("limit") || 20);
          return Response.json({ rows: await listRegistrarSyncJobs(auth.userId, limit) });
        } catch (error) {
          return jsonError(error);
        }
      },
    },
  },
});
