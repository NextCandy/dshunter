import { createFileRoute } from "@tanstack/react-router";
import { jsonError, requireApiAdmin } from "@/lib/api-auth.server";
import { syncRegistrarDomains } from "@/lib/registrar-domains.server";

export const Route = createFileRoute("/api/registrars/$id/sync-domains")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const auth = await requireApiAdmin(request);
          const registrarId = Number(params.id);
          if (!Number.isInteger(registrarId) || registrarId <= 0) {
            return Response.json({ error: "注册商 ID 无效" }, { status: 400 });
          }
          const result = await syncRegistrarDomains({ userId: auth.userId, registrarId });
          return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
        } catch (error) {
          return jsonError(error);
        }
      },
    },
  },
});
