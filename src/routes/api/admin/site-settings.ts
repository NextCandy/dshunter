import { createFileRoute } from "@tanstack/react-router";
import { requireUnlocked } from "@/lib/session.server";
import { saveSiteSettings } from "@/lib/site-settings.server";

async function save(request: Request) {
  try {
    await requireUnlocked();
    const body = await request.json();
    return Response.json({ ok: true, settings: await saveSiteSettings(body) });
  } catch (error) {
    const status = error instanceof Response ? error.status : 400;
    const message = error instanceof Error ? error.message : "站点设置保存失败";
    return Response.json({ ok: false, error: message }, { status });
  }
}

export const Route = createFileRoute("/api/admin/site-settings")({
  server: {
    handlers: {
      POST: ({ request }) => save(request),
      PUT: ({ request }) => save(request),
    },
  },
});
