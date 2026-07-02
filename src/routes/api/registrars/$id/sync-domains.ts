import { createFileRoute } from "@tanstack/react-router";
import { requireUnlocked } from "@/lib/session.server";
import { syncRegistrarDomains, type Registrar } from "@/lib/registrar-sync.server";

const REGISTRARS: readonly Registrar[] = [
  "spaceship",
  "dynadot",
  "porkbun",
  "cf-registrar",
  "namecheap",
  "aliyun",
  "tencent",
  "west",
];

export const Route = createFileRoute("/api/registrars/$id/sync-domains")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        try {
          await requireUnlocked();
          const registrar = params.id as Registrar;
          if (!REGISTRARS.includes(registrar)) {
            return Response.json({ error: "注册商无效" }, { status: 400 });
          }
          const body = await request.json().catch(() => ({}));
          const accountId = typeof body.accountId === "string" ? body.accountId : undefined;
          const result = await syncRegistrarDomains({ registrar, accountId });
          return Response.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "同步失败";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
