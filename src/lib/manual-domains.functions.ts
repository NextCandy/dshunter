import { createServerFn } from "@tanstack/react-start";
import { requireGate } from "./auth-middleware";
import {
  listManualDomains as listManual,
  addManualDomains as addManual,
  updateManualDomain as updateManual,
  updateManualDomains as updateManualBatch,
  deleteManualDomain as deleteManual,
  deleteManualDomains as deleteManualBatch,
  listManualBackups as listBackups,
  restoreManualBackup as restoreBackup,
  type ManualDomainPatch,
} from "./manual-domain-store.server";

export type { ManualDomain, ManualDomainPatch } from "./manual-domain-store.server";

export const listManualDomains = createServerFn({ method: "GET" })
  .middleware([requireGate])
  .handler(async () => ({ rows: await listManual() }));

export const addManualDomains = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .inputValidator((d: { domains: string[] }) => d)
  .handler(async ({ data }) => addManual(data.domains));

export const updateManualDomain = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .inputValidator((d: { id: string; patch: ManualDomainPatch }) => d)
  .handler(async ({ data }) => updateManual(data.id, data.patch));

export const updateManualDomains = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .inputValidator((d: { ids: string[]; patch: ManualDomainPatch }) => d)
  .handler(async ({ data }) => updateManualBatch(data.ids, data.patch));

export const deleteManualDomain = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => ({ ok: await deleteManual(data.id) }));

export const deleteManualDomains = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .inputValidator((d: { ids: string[] }) => d)
  .handler(async ({ data }) => deleteManualBatch(data.ids));

export const listManualBackups = createServerFn({ method: "GET" })
  .middleware([requireGate])
  .handler(async () => ({ rows: await listBackups() }));

export const restoreManualBackup = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .inputValidator((d: { file: string }) => d)
  .handler(async ({ data }) => restoreBackup(data.file));
