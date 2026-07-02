import { createFileRoute } from "@tanstack/react-router";
import { jsonError, requireApiAdmin } from "@/lib/api-auth.server";
import { listRegistrarDomains } from "@/lib/registrar-domains.server";
import type {
  RegistrarDomainSortBy,
  RegistrarDomainStatusFilter,
} from "@/lib/registrar-domains.server";

type SortOrder = "asc" | "desc";

const STATUS_FILTERS: readonly RegistrarDomainStatusFilter[] = [
  "all",
  "active",
  "expiring_soon",
  "expired",
  "sync_error",
  "removed_from_registrar",
];
const SORT_FIELDS: readonly RegistrarDomainSortBy[] = [
  "expiry_date",
  "estimated_value",
  "domain_name",
  "last_synced_at",
];
const SORT_ORDERS: readonly SortOrder[] = ["asc", "desc"];

function readEnum<T extends string>(value: string | null, allowed: readonly T[]) {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export const Route = createFileRoute("/api/registrar-domains")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = await requireApiAdmin(request);
          const url = new URL(request.url);
          const result = await listRegistrarDomains(auth.userId, {
            search: url.searchParams.get("search") || undefined,
            registrar: url.searchParams.get("registrar") || undefined,
            status: readEnum(url.searchParams.get("status"), STATUS_FILTERS),
            page: Number(url.searchParams.get("page") || 1),
            pageSize: Number(url.searchParams.get("pageSize") || 50),
            sortBy: readEnum(url.searchParams.get("sortBy"), SORT_FIELDS),
            sortOrder: readEnum(url.searchParams.get("sortOrder"), SORT_ORDERS),
          });
          return Response.json(result);
        } catch (error) {
          return jsonError(error);
        }
      },
    },
  },
});
