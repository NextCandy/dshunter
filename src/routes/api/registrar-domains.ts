import { createFileRoute } from "@tanstack/react-router";
import { requireUnlocked } from "@/lib/session.server";
import { listPersistedRegistrarDomains } from "@/lib/registrar-domain-store.server";

export const Route = createFileRoute("/api/registrar-domains")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await requireUnlocked();
          return Response.json({ rows: await listPersistedRegistrarDomains() });
        } catch (error) {
          const status = error instanceof Response ? error.status : 500;
          const message = error instanceof Error ? error.message : "读取域名失败";
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
