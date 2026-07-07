import { createServerFn } from "@tanstack/react-start";
import { requireGate } from "./auth-middleware";
import { readSiteSettings, saveSiteSettings } from "./site-settings.server";

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  return { settings: await readSiteSettings() };
});

export const saveAdminSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }) => {
    return { ok: true as const, settings: await saveSiteSettings(data) };
  });
