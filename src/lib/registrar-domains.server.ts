import { query, withClient } from "@/lib/db.server";

export type RegistrarDomainSortBy =
  "expiry_date" | "estimated_value" | "domain_name" | "last_synced_at";

export type RegistrarDomainStatusFilter =
  "all" | "active" | "expiring_soon" | "expired" | "sync_error" | "removed_from_registrar";

export type RegistrarDomainFilters = {
  search?: string;
  registrar?: string;
  status?: RegistrarDomainStatusFilter;
  page?: number;
  pageSize?: number;
  sortBy?: RegistrarDomainSortBy;
  sortOrder?: "asc" | "desc";
};

type RegistrarRow = {
  id: number;
  name: string;
  slug: string | null;
  api_key_encrypted: string | null;
  api_secret_encrypted: string | null;
  api_enabled: boolean;
  enabled: boolean;
  status: string;
  config_json: Record<string, unknown> | null;
};

type NormalizedRegistrarDomain = {
  domainName: string;
  expiryDate: string | null;
  estimatedValue: number | null;
  autoRenew: boolean | null;
  nameservers: string[];
  domainStatus: string;
  rawData: Record<string, unknown>;
  syncStatus: "ok" | "warning";
  syncError: string | null;
};

type SyncSummary = {
  jobId: number;
  registrar: string;
  totalCount: number;
  createdCount: number;
  updatedCount: number;
  missingCount: number;
  failedCount: number;
  status: "success" | "failed";
  errorMessage?: string;
};

const SORT_COLUMNS: Record<RegistrarDomainSortBy, string> = {
  expiry_date: "d.expiry_date",
  estimated_value: "d.estimated_value",
  domain_name: "d.domain_name",
  last_synced_at: "d.last_synced_at",
};

function normalizeDomainName(input: unknown) {
  const value = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!value || value.length > 253) return null;
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      value,
    )
  ) {
    return null;
  }
  return value;
}

function normalizeDate(value: unknown): { value: string | null; error: string | null } {
  if (value == null || value === "") return { value: null, error: null };
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return { value: null, error: "注册商返回的到期时间无法解析" };
  }
  return { value: d.toISOString(), error: null };
}

function normalizeNameservers(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\s]+/) : [];
  return Array.from(
    new Set(
      raw
        .map((item) =>
          String(item ?? "")
            .trim()
            .toLowerCase()
            .replace(/\.$/, ""),
        )
        .filter(Boolean),
    ),
  );
}

function providerSlug(registrar: RegistrarRow) {
  return String(registrar.slug || registrar.name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function envFirst(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

async function decrypt(value: string | null) {
  if (!value) return "";
  const { decryptSecret } = await import("@/lib/secret-crypto.server");
  return decryptSecret(value) ?? "";
}

async function credentialsFor(registrar: RegistrarRow) {
  const slug = providerSlug(registrar);
  const cfg = registrar.config_json ?? {};
  const apiKeyEnv = typeof cfg.api_key_env === "string" ? cfg.api_key_env : "";
  const apiSecretEnv = typeof cfg.api_secret_env === "string" ? cfg.api_secret_env : "";
  const apiKey =
    (await decrypt(registrar.api_key_encrypted)) ||
    (apiKeyEnv ? envFirst(apiKeyEnv) : "") ||
    (slug.includes("porkbun")
      ? envFirst("PORKBUN_API_KEY")
      : slug.includes("spaceship")
        ? envFirst("SPACESHIP_API_KEY")
        : slug.includes("godaddy")
          ? envFirst("GODADDY_API_KEY")
          : "");
  const apiSecret =
    (await decrypt(registrar.api_secret_encrypted)) ||
    (apiSecretEnv ? envFirst(apiSecretEnv) : "") ||
    (slug.includes("porkbun")
      ? envFirst("PORKBUN_SECRET_API_KEY")
      : slug.includes("spaceship")
        ? envFirst("SPACESHIP_API_SECRET", "SPACESHIP_API_KEY_SECRET")
        : slug.includes("godaddy")
          ? envFirst("GODADDY_API_SECRET")
          : "");

  return { apiKey, apiSecret };
}

function normalizeProviderItem(
  item: Record<string, unknown>,
  registrar: string,
): NormalizedRegistrarDomain | null {
  const domainName = normalizeDomainName(
    item.domain ?? item.name ?? item.domainName ?? item.fqdn ?? item.DomainName,
  );
  if (!domainName) return null;

  const date = normalizeDate(
    item.expiryDate ??
      item.expirationDate ??
      item.expireDate ??
      item.expires ??
      item.renewalDate ??
      item.expiry_date,
  );
  const rawStatus = String(
    item.status ?? item.domainStatus ?? item.state ?? "active",
  ).toLowerCase();
  const status =
    rawStatus.includes("delete") || rawStatus.includes("expired") ? rawStatus : "active";
  const estimatedRaw = item.estimatedValue ?? item.estimated_value ?? item.value;
  const estimatedValue = estimatedRaw == null || estimatedRaw === "" ? null : Number(estimatedRaw);

  return {
    domainName,
    expiryDate: date.value,
    estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : null,
    autoRenew:
      typeof item.autoRenew === "boolean"
        ? item.autoRenew
        : typeof item.auto_renew === "boolean"
          ? item.auto_renew
          : null,
    nameservers: normalizeNameservers(item.nameservers ?? item.nameServers ?? item.ns),
    domainStatus: status,
    rawData: { registrar, ...item },
    syncStatus: date.error ? "warning" : "ok",
    syncError: date.error,
  };
}

function domainsFromConfig(registrar: RegistrarRow) {
  const cfg = registrar.config_json ?? {};
  const mock = Array.isArray(cfg.mock_domains) ? cfg.mock_domains : [];
  return mock
    .map((item) =>
      normalizeProviderItem(
        typeof item === "string" ? { domain: item } : (item as Record<string, unknown>),
        registrar.name,
      ),
    )
    .filter(Boolean) as NormalizedRegistrarDomain[];
}

async function fetchSpaceshipDomains(registrar: RegistrarRow) {
  const configured = domainsFromConfig(registrar);
  if (configured.length) return configured;

  const { apiKey, apiSecret } = await credentialsFor(registrar);
  if (!apiKey || !apiSecret) {
    throw new Error(
      "缺少 Spaceship API Key / Secret，请在后台注册商配置中保存凭证，或在 NAS Docker .env 中配置 SPACESHIP_API_KEY / SPACESHIP_API_SECRET",
    );
  }

  const out: NormalizedRegistrarDomain[] = [];
  const take = 100;
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;
  while (skip < total && skip < 100_000) {
    const res = await fetch(`https://spaceship.dev/api/v1/domains?take=${take}&skip=${skip}`, {
      headers: {
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Spaceship API 返回 HTTP ${res.status}`);
    const body = (await res.json()) as { items?: Record<string, unknown>[]; total?: number };
    const items = Array.isArray(body.items) ? body.items : [];
    total = typeof body.total === "number" ? body.total : items.length;
    for (const item of items) {
      const normalized = normalizeProviderItem(item, "Spaceship");
      if (normalized) out.push(normalized);
    }
    if (!items.length) break;
    skip += take;
  }
  return out;
}

async function fetchPorkbunDomains(registrar: RegistrarRow) {
  const configured = domainsFromConfig(registrar);
  if (configured.length) return configured;

  const { apiKey, apiSecret } = await credentialsFor(registrar);
  if (!apiKey || !apiSecret) {
    throw new Error(
      "缺少 Porkbun API Key / Secret API Key，请在后台注册商配置中保存凭证，或在 NAS Docker .env 中配置 PORKBUN_API_KEY / PORKBUN_SECRET_API_KEY",
    );
  }

  const out: NormalizedRegistrarDomain[] = [];
  let start = 0;
  const pageSize = 1000;
  while (start < 100_000) {
    const res = await fetch(`https://api.porkbun.com/api/json/v3/domain/listAll?start=${start}`, {
      headers: {
        "X-API-Key": apiKey,
        "X-Secret-API-Key": apiSecret,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      domains?: Record<string, unknown>[];
      message?: string;
    };
    if (!res.ok || body.status === "ERROR") {
      throw new Error(
        `Porkbun API 返回错误${body.message ? `：${String(body.message).slice(0, 120)}` : ""}`,
      );
    }
    const items = Array.isArray(body.domains) ? body.domains : [];
    for (const item of items) {
      const normalized = normalizeProviderItem(item, "Porkbun");
      if (normalized) out.push(normalized);
    }
    if (items.length < pageSize) break;
    start += items.length;
  }
  return out;
}

async function fetchRegistrarDomains(registrar: RegistrarRow) {
  const slug = providerSlug(registrar);
  if (slug.includes("spaceship")) return fetchSpaceshipDomains(registrar);
  if (slug.includes("porkbun")) return fetchPorkbunDomains(registrar);

  const configured = domainsFromConfig(registrar);
  if (configured.length) return configured;

  throw new Error(
    `当前版本暂未实现 ${registrar.name} 的真实域名列表 API。可先在 config_json.mock_domains 中放入测试数据，或补充该注册商 provider。`,
  );
}

async function getRegistrar(registrarId: number) {
  const { rows } = await query<RegistrarRow>(
    `SELECT id, name, slug, api_key_encrypted, api_secret_encrypted, api_enabled,
            enabled, status, config_json
       FROM public.registrars
      WHERE id = $1
      LIMIT 1`,
    [registrarId],
  );
  const registrar = rows[0];
  if (!registrar) throw new Error("注册商不存在");
  return registrar;
}

async function ensureAccount(userId: string, registrar: RegistrarRow) {
  const { rows } = await query<{ id: number }>(
    `INSERT INTO public.registrar_accounts (user_id, registrar_id, registrar, display_name, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (user_id, registrar_id)
     DO UPDATE SET registrar = EXCLUDED.registrar,
                   display_name = EXCLUDED.display_name,
                   status = 'active'
     RETURNING id`,
    [userId, registrar.id, registrar.slug || registrar.name, registrar.name],
  );
  return rows[0].id;
}

export async function syncRegistrarDomains(input: {
  userId: string;
  registrarId: number;
}): Promise<SyncSummary> {
  const registrar = await getRegistrar(input.registrarId);
  const accountId = await ensureAccount(input.userId, registrar);
  const started = await query<{ id: number }>(
    `INSERT INTO public.registrar_sync_jobs (user_id, registrar_account_id, registrar, status)
     VALUES ($1, $2, $3, 'running')
     RETURNING id`,
    [input.userId, accountId, registrar.name],
  );
  const jobId = started.rows[0].id;

  try {
    const fetched = await fetchRegistrarDomains(registrar);
    const deduped = Array.from(new Map(fetched.map((item) => [item.domainName, item])).values());
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const seen = deduped.map((item) => item.domainName);

    await withClient(async (client) => {
      for (const item of deduped) {
        try {
          const result = await client.query<{ inserted: boolean }>(
            `INSERT INTO public.registrar_domains (
               user_id, registrar_account_id, registrar, domain_name, expiry_date,
               estimated_value, auto_renew, nameservers, domain_status, raw_data,
               sync_status, sync_error, first_seen_at, last_seen_at, last_synced_at,
               removed_from_registrar_at
             )
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now(),now(),NULL)
             ON CONFLICT (user_id, registrar_account_id, domain_name)
             DO UPDATE SET registrar = EXCLUDED.registrar,
                           expiry_date = EXCLUDED.expiry_date,
                           estimated_value = EXCLUDED.estimated_value,
                           auto_renew = EXCLUDED.auto_renew,
                           nameservers = EXCLUDED.nameservers,
                           domain_status = EXCLUDED.domain_status,
                           raw_data = EXCLUDED.raw_data,
                           sync_status = EXCLUDED.sync_status,
                           sync_error = EXCLUDED.sync_error,
                           last_seen_at = now(),
                           last_synced_at = now(),
                           removed_from_registrar_at = NULL
             RETURNING (xmax = 0) AS inserted`,
            [
              input.userId,
              accountId,
              registrar.name,
              item.domainName,
              item.expiryDate,
              item.estimatedValue,
              item.autoRenew,
              item.nameservers,
              item.domainStatus,
              JSON.stringify(item.rawData),
              item.syncStatus,
              item.syncError,
            ],
          );
          if (result.rows[0]?.inserted) createdCount++;
          else updatedCount++;
        } catch {
          failedCount++;
        }
      }

      const missing = await client.query<{ id: number }>(
        `UPDATE public.registrar_domains
            SET domain_status = 'removed_from_registrar',
                sync_status = 'missing',
                removed_from_registrar_at = COALESCE(removed_from_registrar_at, now()),
                last_synced_at = now()
          WHERE user_id = $1
            AND registrar_account_id = $2
            AND NOT (domain_name = ANY($3::citext[]))
            AND domain_status <> 'removed_from_registrar'
          RETURNING id`,
        [input.userId, accountId, seen],
      );

      await client.query(
        `UPDATE public.registrar_sync_jobs
            SET status = $2,
                finished_at = now(),
                total_count = $3,
                created_count = $4,
                updated_count = $5,
                missing_count = $6,
                failed_count = $7,
                details = $8
          WHERE id = $1`,
        [
          jobId,
          failedCount ? "partial_success" : "success",
          deduped.length,
          createdCount,
          updatedCount,
          missing.rowCount,
          failedCount,
          JSON.stringify({ provider: providerSlug(registrar) }),
        ],
      );
      await client.query(`UPDATE public.registrars SET last_domain_sync_at = now() WHERE id = $1`, [
        registrar.id,
      ]);
    });

    const job = await getSyncJob(jobId, input.userId);
    return {
      jobId,
      registrar: registrar.name,
      totalCount: job?.total_count ?? deduped.length,
      createdCount: job?.created_count ?? createdCount,
      updatedCount: job?.updated_count ?? updatedCount,
      missingCount: job?.missing_count ?? 0,
      failedCount: job?.failed_count ?? failedCount,
      status: "success",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    await query(
      `UPDATE public.registrar_sync_jobs
          SET status = 'failed',
              finished_at = now(),
              failed_count = 1,
              error_message = $2
        WHERE id = $1`,
      [jobId, message.slice(0, 1000)],
    );
    return {
      jobId,
      registrar: registrar.name,
      totalCount: 0,
      createdCount: 0,
      updatedCount: 0,
      missingCount: 0,
      failedCount: 1,
      status: "failed",
      errorMessage: message,
    };
  }
}

async function getSyncJob(id: number, userId: string) {
  const { rows } = await query<{
    total_count: number;
    created_count: number;
    updated_count: number;
    missing_count: number;
    failed_count: number;
  }>(
    `SELECT total_count, created_count, updated_count, missing_count, failed_count
       FROM public.registrar_sync_jobs
      WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return rows[0] ?? null;
}

function domainWhere(filters: RegistrarDomainFilters, userId: string) {
  const where = ["d.user_id = $1"];
  const params: unknown[] = [userId];
  let i = 2;
  if (filters.search?.trim()) {
    where.push(
      `(d.domain_name::text ILIKE $${i} OR d.registrar ILIKE $${i} OR d.note ILIKE $${i})`,
    );
    params.push(`%${filters.search.trim()}%`);
    i++;
  }
  if (filters.registrar && filters.registrar !== "all") {
    where.push(`d.registrar = $${i++}`);
    params.push(filters.registrar);
  }
  const status = filters.status ?? "all";
  if (status === "active") where.push(`d.domain_status = 'active' AND d.sync_status <> 'missing'`);
  if (status === "expiring_soon")
    where.push(`d.expiry_date >= now() AND d.expiry_date < now() + interval '30 days'`);
  if (status === "expired") where.push(`d.expiry_date < now()`);
  if (status === "sync_error") where.push(`d.sync_status IN ('error', 'warning')`);
  if (status === "removed_from_registrar")
    where.push(`d.domain_status = 'removed_from_registrar' OR d.sync_status = 'missing'`);
  return { where: where.join(" AND "), params };
}

export async function listRegistrarDomains(userId: string, filters: RegistrarDomainFilters = {}) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(200, Math.max(10, Number(filters.pageSize || 50)));
  const from = (page - 1) * pageSize;
  const sortBy = filters.sortBy && SORT_COLUMNS[filters.sortBy] ? filters.sortBy : "expiry_date";
  const sortOrder = filters.sortOrder === "desc" ? "DESC" : "ASC";
  const { where, params } = domainWhere(filters, userId);

  const count = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c
       FROM public.registrar_domains d
      WHERE ${where}`,
    params,
  );
  const rows = await query(
    `SELECT d.*, a.display_name AS registrar_account_name
       FROM public.registrar_domains d
       LEFT JOIN public.registrar_accounts a ON a.id = d.registrar_account_id
      WHERE ${where}
      ORDER BY ${SORT_COLUMNS[sortBy]} ${sortOrder} NULLS LAST, d.domain_name ASC
      LIMIT ${pageSize} OFFSET ${from}`,
    params,
  );
  return { rows: rows.rows, total: count.rows[0]?.c ?? 0, page, pageSize };
}

export async function listRegistrarSyncJobs(userId: string, limit = 20) {
  const { rows } = await query(
    `SELECT j.*, a.display_name AS registrar_account_name
       FROM public.registrar_sync_jobs j
       LEFT JOIN public.registrar_accounts a ON a.id = j.registrar_account_id
      WHERE j.user_id = $1
      ORDER BY j.created_at DESC
      LIMIT $2`,
    [userId, Math.min(100, Math.max(1, limit))],
  );
  return rows;
}

export async function getRegistrarDomain(userId: string, id: number) {
  const { rows } = await query(
    `SELECT d.*, a.display_name AS registrar_account_name
       FROM public.registrar_domains d
       LEFT JOIN public.registrar_accounts a ON a.id = d.registrar_account_id
      WHERE d.user_id = $1 AND d.id = $2
      LIMIT 1`,
    [userId, id],
  );
  return rows[0] ?? null;
}

export async function updateRegistrarDomain(
  userId: string,
  id: number,
  patch: { note?: string | null; estimated_value?: number | null; domain_status?: string | null },
) {
  const allowed: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if ("note" in patch) {
    allowed.push(`note = $${i++}`);
    params.push(patch.note ?? null);
  }
  if ("estimated_value" in patch) {
    allowed.push(`estimated_value = $${i++}`);
    params.push(patch.estimated_value ?? null);
  }
  if (patch.domain_status) {
    allowed.push(`domain_status = $${i++}`);
    params.push(patch.domain_status);
  }
  if (!allowed.length) return getRegistrarDomain(userId, id);
  params.push(userId, id);
  const { rows } = await query(
    `UPDATE public.registrar_domains
        SET ${allowed.join(", ")}
      WHERE user_id = $${i++} AND id = $${i}
      RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function registrarDomainStats(userId: string) {
  const { rows } = await query<{
    total_domains: number;
    expiring_soon: number;
    expired: number;
    total_value: string | null;
    synced_registrars: number;
    sync_failures: number;
    last_synced_at: string | null;
  }>(
    `SELECT
       COUNT(*)::int AS total_domains,
       COUNT(*) FILTER (WHERE expiry_date >= now() AND expiry_date < now() + interval '30 days')::int AS expiring_soon,
       COUNT(*) FILTER (WHERE expiry_date < now())::int AS expired,
       COALESCE(SUM(estimated_value), 0)::text AS total_value,
       COUNT(DISTINCT registrar_account_id)::int AS synced_registrars,
       COUNT(*) FILTER (WHERE sync_status IN ('error','warning'))::int AS sync_failures,
       MAX(last_synced_at) AS last_synced_at
     FROM public.registrar_domains
     WHERE user_id = $1`,
    [userId],
  );
  const jobs = await query<{ failed_jobs: number }>(
    `SELECT COUNT(*)::int AS failed_jobs
       FROM public.registrar_sync_jobs
      WHERE user_id = $1 AND status IN ('failed','partial_success')`,
    [userId],
  );
  return {
    totalDomains: rows[0]?.total_domains ?? 0,
    expiringSoon: rows[0]?.expiring_soon ?? 0,
    expired: rows[0]?.expired ?? 0,
    totalValue: Number(rows[0]?.total_value ?? 0),
    syncedRegistrars: rows[0]?.synced_registrars ?? 0,
    syncFailures: (rows[0]?.sync_failures ?? 0) + (jobs.rows[0]?.failed_jobs ?? 0),
    lastSyncedAt: rows[0]?.last_synced_at ?? null,
  };
}

export async function listSyncableRegistrars() {
  const { rows } = await query(
    `SELECT id, name, slug, enabled, api_enabled, last_domain_sync_at,
            (api_key_encrypted IS NOT NULL OR config_json ? 'mock_domains') AS has_api_key,
            (api_secret_encrypted IS NOT NULL OR config_json ? 'mock_domains') AS has_api_secret
       FROM public.registrars
      WHERE enabled = true
      ORDER BY name ASC`,
  );
  return rows;
}
