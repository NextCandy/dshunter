import { createFileRoute } from "@tanstack/react-router";
import { requireUnlocked } from "@/lib/session.server";
import {
  getPersistedRegistrarDomain,
  updatePersistedRegistrarDomain,
} from "@/lib/registrar-domain-store.server";

export const Route = createFileRoute("/api/registrar-domains/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await requireUnlocked();
          const row = await getPersistedRegistrarDomain(params.id);
          if (!row) return Response.json({ error: "域名不存在" }, { status: 404 });
          return Response.json({ row });
        } catch (error) {
          const status = error instanceof Response ? error.status : 500;
          const message = error instanceof Error ? error.message : "读取域名失败";
          return Response.json({ error: message }, { status });
        }
      },
      PATCH: async ({ params, request }) => {
        try {
          await requireUnlocked();
          const body = await request.json().catch(() => ({}));
          const row = await updatePersistedRegistrarDomain(params.id, {
            note: typeof body.note === "string" || body.note === null ? body.note : undefined,
          });
          if (!row) return Response.json({ error: "域名不存在" }, { status: 404 });
          return Response.json({ row });
        } catch (error) {
          const status = error instanceof Response ? error.status : 500;
          const message = error instanceof Error ? error.message : "保存域名失败";
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
