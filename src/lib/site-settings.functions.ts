import { createServerFn } from "@tanstack/react-start";
import { requireGate } from "./auth-middleware";
import { recordOperationLog } from "./operation-log.server";
import { readSiteSettings, saveSiteSettings } from "./site-settings.server";

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  return { settings: await readSiteSettings() };
});

export const saveAdminSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }) => {
    const settings = await saveSiteSettings(data);
    await recordOperationLog({
      category: "settings",
      action: "site_settings.save",
      title: "保存站点设置",
      detail: "后台站点展示配置已更新。",
      entityType: "site-settings",
      severity: "success",
      metadata: {
        siteName: settings.siteName,
        hasLogo: Boolean(settings.logoUrl),
        hasFavicon: Boolean(settings.faviconUrl),
        socialLinks: settings.socialLinks.length,
      },
    });
    return { ok: true as const, settings };
  });
