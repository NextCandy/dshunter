import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import {
  getRegistrarDomain,
  listRegistrarDomains,
  listRegistrarSyncJobs,
  listSyncableRegistrars,
  registrarDomainStats,
  syncRegistrarDomains,
  updateRegistrarDomain,
  type RegistrarDomainFilters,
} from "@/lib/registrar-domains.server";

const filtersSchema = z.object({
  search: z.string().max(200).optional(),
  registrar: z.string().max(120).optional(),
  status: z
    .enum(["all", "active", "expiring_soon", "expired", "sync_error", "removed_from_registrar"])
    .optional(),
  page: z.number().int().min(1).max(1000).optional(),
  pageSize: z.number().int().min(10).max(200).optional(),
  sortBy: z.enum(["expiry_date", "estimated_value", "domain_name", "last_synced_at"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const listRegistrarDomainsFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => filtersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) =>
    listRegistrarDomains(context.userId, data as RegistrarDomainFilters),
  );

export const registrarDomainStatsFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => registrarDomainStats(context.userId));

export const listRegistrarSyncJobsFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => listRegistrarSyncJobs(context.userId, 20));

export const listSyncableRegistrarsFn = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => listSyncableRegistrars());

export const syncRegistrarDomainsFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ registrarId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) =>
    syncRegistrarDomains({ userId: context.userId, registrarId: data.registrarId }),
  );

export const getRegistrarDomainFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => getRegistrarDomain(context.userId, data.id));

export const updateRegistrarDomainFn = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.number().int().positive(),
        patch: z.object({
          note: z.string().max(1000).nullable().optional(),
          estimated_value: z.number().nonnegative().nullable().optional(),
          domain_status: z.string().max(60).nullable().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => updateRegistrarDomain(context.userId, data.id, data.patch));
