import { createServerFn } from "@tanstack/react-start";
import { listPersistedRegistrarDomains } from "./registrar-domain-store.server";

export const listPublicDomainAssets = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await listPersistedRegistrarDomains();
  return {
    rows: rows.map((row) => ({
      domain: row.domain,
      registrar: row.registrar,
      nsStatus: row.nsStatus,
      lastSyncedAt: row.lastSyncedAt,
      syncStatus: row.syncStatus,
      nsProvider: row.nsProvider,
    })),
  };
});
