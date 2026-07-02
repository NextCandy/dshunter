import { createFileRoute } from "@tanstack/react-router";
import { requireUnlocked } from "@/lib/session.server";
import { listPersistedRegistrarSyncJobs } from "@/lib/registrar-domain-store.server";

export const Route = createFileRoute("/api/registrar-sync-jobs")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await requireUnlocked();
          return Response.json({ rows: await listPersistedRegistrarSyncJobs() });
        } catch (error) {
          const status = error instanceof Response ? error.status : 500;
          const message = error instanceof Error ? error.message : "读取同步记录失败";
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
