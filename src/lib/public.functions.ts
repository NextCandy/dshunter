import { createServerFn } from "@tanstack/react-start";
import { listPersistedRegistrarDomains } from "./registrar-domain-store.server";
import { listManualDomains } from "./manual-domain-store.server";

export type PublicDomainRow = {
  domain: string;
  registrar: string;
  nsStatus: "cloudflare" | "other" | "unknown";
  lastSyncedAt: string;
  syncStatus: "ok" | "missing" | "warning";
  nsProvider?: string;
  registeredAt?: string;
  expiresAt?: string;
  source: "registrar" | "manual";
};

// 前台资产台账：合并「注册商 API 域名」与「手动域名」，按域名去重（注册商优先）。
export const listPublicDomainAssets = createServerFn({ method: "GET" }).handler(async () => {
  const [registrarRows, manualRows] = await Promise.all([
    listPersistedRegistrarDomains(),
    listManualDomains(),
  ]);

  const seen = new Set<string>();
  const rows: PublicDomainRow[] = [];

  for (const row of registrarRows) {
    seen.add(row.domain);
    rows.push({
      domain: row.domain,
      registrar: row.registrar,
      nsStatus: row.nsStatus,
      lastSyncedAt: row.lastSyncedAt,
      syncStatus: row.syncStatus,
      nsProvider: row.nsProvider,
      registeredAt: row.registeredAt,
      expiresAt: row.expiresAt,
      source: "registrar",
    });
  }

  for (const row of manualRows) {
    if (seen.has(row.domain)) continue;
    seen.add(row.domain);
    rows.push({
      domain: row.domain,
      registrar: row.registrar ?? "manual",
      nsStatus: row.nsStatus,
      lastSyncedAt: row.updatedAt,
      syncStatus: "ok",
      nsProvider: row.nsProvider,
      registeredAt: row.registeredAt,
      expiresAt: row.expiresAt,
      source: "manual",
    });
  }

  return { rows };
});
