import { createFileRoute } from "@tanstack/react-router";
import { jsonError, requireApiAdmin } from "@/lib/api-auth.server";
import { getRegistrarDomain, updateRegistrarDomain } from "@/lib/registrar-domains.server";

export const Route = createFileRoute("/api/registrar-domains/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const auth = await requireApiAdmin(request);
          const id = Number(params.id);
          if (!Number.isInteger(id) || id <= 0)
            return Response.json({ error: "域名 ID 无效" }, { status: 400 });
          const row = await getRegistrarDomain(auth.userId, id);
          if (!row) return Response.json({ error: "域名不存在" }, { status: 404 });
          return Response.json({ row });
        } catch (error) {
          return jsonError(error);
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const auth = await requireApiAdmin(request);
          const id = Number(params.id);
          if (!Number.isInteger(id) || id <= 0)
            return Response.json({ error: "域名 ID 无效" }, { status: 400 });
          const body = await request.json().catch(() => ({}));
          const row = await updateRegistrarDomain(auth.userId, id, {
            note: typeof body.note === "string" || body.note === null ? body.note : undefined,
            estimated_value:
              typeof body.estimated_value === "number" || body.estimated_value === null
                ? body.estimated_value
                : undefined,
            domain_status: typeof body.domain_status === "string" ? body.domain_status : undefined,
          });
          if (!row) return Response.json({ error: "域名不存在" }, { status: 404 });
          return Response.json({ row });
        } catch (error) {
          return jsonError(error);
        }
      },
    },
  },
});
