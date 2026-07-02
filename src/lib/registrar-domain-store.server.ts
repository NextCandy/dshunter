import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type PersistedRegistrar =
  | "spaceship"
  | "dynadot"
  | "porkbun"
  | "cf-registrar"
  | "namecheap"
  | "aliyun"
  | "tencent"
  | "west";

export type PersistedRegistrarDomain = {
  id: string;
  registrar: PersistedRegistrar;
  domain: string;
  nameservers: string[];
  nsStatus: "cloudflare" | "other" | "unknown";
  nsProvider?: string;
  nsError?: string;
  note?: string;
  syncStatus: "ok" | "missing" | "warning";
  syncError?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSyncedAt: string;
  removedFromRegistrarAt?: string;
  updatedAt: string;
};

export type RegistrarSyncJob = {
  id: string;
  registrar: PersistedRegistrar;
  status: "success" | "partial_success" | "failed";
  startedAt: string;
  finishedAt: string;
  totalCount: number;
  createdCount: number;
  updatedCount: number;
  missingCount: number;
  failedCount: number;
  errorMessage?: string;
};

type Store = {
  v: 1;
  domains: Record<string, PersistedRegistrarDomain>;
  jobs: RegistrarSyncJob[];
};

export type SyncableRegistrarDomain = {
  domain: string;
  nameservers?: string[];
  nsStatus?: "cloudflare" | "other" | "unknown";
  nsProvider?: string;
  nsError?: string;
};

const FILE =
  process.env.REGISTRAR_DOMAINS_FILE || join(process.cwd(), "data", "registrar-domains.json");

let cache: Store | null = null;

function emptyStore(): Store {
  return { v: 1, domains: {}, jobs: [] };
}

function keyOf(registrar: PersistedRegistrar, domain: string) {
  return `${registrar}:${domain}`;
}

async function readStore(): Promise<Store> {
  if (cache) return cache;
  try {
    const txt = await readFile(FILE, "utf8");
    const parsed = JSON.parse(txt);
    cache = {
      v: 1,
      domains: parsed?.domains && typeof parsed.domains === "object" ? parsed.domains : {},
      jobs: Array.isArray(parsed?.jobs) ? parsed.jobs : [],
    };
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    const message = error instanceof Error ? error.message : String(error);
    if (code !== "ENOENT") {
      console.error("[registrar-domain-store] 读取失败:", message);
    }
    cache = emptyStore();
  }
  return cache;
}

async function writeStore(store: Store) {
  cache = store;
  await mkdir(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, FILE);
}

export async function listPersistedRegistrarDomains() {
  const store = await readStore();
  return Object.values(store.domains).sort((a, b) => {
    const missing = Number(a.syncStatus === "missing") - Number(b.syncStatus === "missing");
    if (missing !== 0) return missing;
    return a.domain.localeCompare(b.domain);
  });
}

export async function listPersistedRegistrarSyncJobs() {
  const store = await readStore();
  return [...store.jobs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getPersistedRegistrarDomain(id: string) {
  const store = await readStore();
  return Object.values(store.domains).find((row) => row.id === id) ?? null;
}

export async function updatePersistedRegistrarDomain(id: string, patch: { note?: string | null }) {
  const store = await readStore();
  const key = Object.keys(store.domains).find((candidate) => store.domains[candidate].id === id);
  if (!key) return null;
  const current = store.domains[key];
  store.domains[key] = {
    ...current,
    note: patch.note === null ? undefined : (patch.note ?? current.note),
    updatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return store.domains[key];
}

export async function syncRegistrarDomainsToStore(
  registrar: PersistedRegistrar,
  items: SyncableRegistrarDomain[],
): Promise<{ domains: PersistedRegistrarDomain[]; job: RegistrarSyncJob }> {
  const store = await readStore();
  const startedAt = new Date().toISOString();
  const seen = new Set<string>();
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    try {
      const domain = String(item.domain || "")
        .trim()
        .toLowerCase();
      if (!domain) throw new Error("域名为空");
      seen.add(domain);
      const now = new Date().toISOString();
      const key = keyOf(registrar, domain);
      const existing = store.domains[key];
      if (existing) {
        updatedCount += 1;
        store.domains[key] = {
          ...existing,
          nameservers: item.nameservers ?? [],
          nsStatus: item.nsStatus ?? "unknown",
          nsProvider: item.nsProvider,
          nsError: item.nsError,
          syncStatus: item.nsError ? "warning" : "ok",
          syncError: item.nsError,
          lastSeenAt: now,
          lastSyncedAt: now,
          removedFromRegistrarAt: undefined,
          updatedAt: now,
        };
      } else {
        createdCount += 1;
        store.domains[key] = {
          id: randomUUID(),
          registrar,
          domain,
          nameservers: item.nameservers ?? [],
          nsStatus: item.nsStatus ?? "unknown",
          nsProvider: item.nsProvider,
          nsError: item.nsError,
          syncStatus: item.nsError ? "warning" : "ok",
          syncError: item.nsError,
          firstSeenAt: now,
          lastSeenAt: now,
          lastSyncedAt: now,
          updatedAt: now,
        };
      }
    } catch (error) {
      failedCount += 1;
      console.error("[registrar-domain-store] 单域名同步失败:", error);
    }
  }

  let missingCount = 0;
  const finishedAt = new Date().toISOString();
  for (const [key, row] of Object.entries(store.domains)) {
    if (row.registrar !== registrar || seen.has(row.domain) || row.syncStatus === "missing") {
      continue;
    }
    missingCount += 1;
    store.domains[key] = {
      ...row,
      syncStatus: "missing",
      removedFromRegistrarAt: finishedAt,
      lastSyncedAt: finishedAt,
      updatedAt: finishedAt,
    };
  }

  const job: RegistrarSyncJob = {
    id: randomUUID(),
    registrar,
    status: failedCount > 0 ? "partial_success" : "success",
    startedAt,
    finishedAt,
    totalCount: items.length,
    createdCount,
    updatedCount,
    missingCount,
    failedCount,
  };
  store.jobs = [job, ...store.jobs].slice(0, 100);
  await writeStore(store);

  const domains = Object.values(store.domains)
    .filter((row) => row.registrar === registrar)
    .sort((a, b) => a.domain.localeCompare(b.domain));
  return { domains, job };
}

export async function recordRegistrarSyncFailure(
  registrar: PersistedRegistrar,
  error: unknown,
): Promise<RegistrarSyncJob> {
  const store = await readStore();
  const now = new Date().toISOString();
  const job: RegistrarSyncJob = {
    id: randomUUID(),
    registrar,
    status: "failed",
    startedAt: now,
    finishedAt: now,
    totalCount: 0,
    createdCount: 0,
    updatedCount: 0,
    missingCount: 0,
    failedCount: 1,
    errorMessage: error instanceof Error ? error.message : "同步失败",
  };
  store.jobs = [job, ...store.jobs].slice(0, 100);
  await writeStore(store);
  return job;
}
