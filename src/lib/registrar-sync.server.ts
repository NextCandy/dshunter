import { normalizeDomain } from "./domain-utils";
import { resolveDomainsNameservers, type NameserverStatus } from "./nameservers.server";
import {
  recordRegistrarSyncFailure,
  syncRegistrarDomainsToStore,
  type PersistedRegistrar,
} from "./registrar-domain-store.server";

export type Registrar =
  | "spaceship"
  | "dynadot"
  | "porkbun"
  | "cf-registrar"
  | "namecheap"
  | "aliyun"
  | "tencent"
  | "west";

export type RegistrarDomainItem = {
  domain: string;
  nameservers: string[];
  nsStatus: NameserverStatus;
  nsProvider?: string;
  nsError?: string;
};

async function fetchRawDomains(registrar: Registrar, accountId?: string) {
  if (registrar === "spaceship") {
    const { spaceshipListDomains } = await import("./registrars/spaceship.server");
    return spaceshipListDomains();
  }
  if (registrar === "dynadot") {
    const { dynadotListDomains } = await import("./registrars/dynadot.server");
    return dynadotListDomains();
  }
  if (registrar === "porkbun") {
    const { porkbunListDomains } = await import("./registrars/porkbun.server");
    return porkbunListDomains();
  }
  if (registrar === "cf-registrar") {
    if (!accountId) throw new Error("需要 accountId");
    const { cfRegListDomains } = await import("./registrars/cf-registrar.server");
    return cfRegListDomains(accountId);
  }
  if (registrar === "namecheap") {
    const { namecheapListDomains } = await import("./registrars/namecheap.server");
    return namecheapListDomains();
  }
  if (registrar === "aliyun") {
    const { aliyunListDomains } = await import("./registrars/aliyun.server");
    return aliyunListDomains();
  }
  if (registrar === "tencent") {
    const { tencentListDomains } = await import("./registrars/tencent.server");
    return tencentListDomains();
  }
  if (registrar === "west") {
    const { westListDomains } = await import("./registrars/west.server");
    return westListDomains();
  }
  return [];
}

export async function pullRegistrarDomainItems(input: {
  registrar: Registrar;
  accountId?: string;
}): Promise<RegistrarDomainItem[]> {
  const raw = await fetchRawDomains(input.registrar, input.accountId);
  const set = new Set<string>();
  for (const d of raw) {
    const n = normalizeDomain(d);
    if (n) set.add(n);
  }

  const domains = [...set].sort();
  const nsMap = await resolveDomainsNameservers(domains);
  return domains.map((domain) => {
    const ns = nsMap.get(domain);
    return {
      domain,
      nameservers: ns?.nameservers ?? [],
      nsStatus: ns?.nsStatus ?? "unknown",
      nsProvider: ns?.nsProvider,
      nsError: ns?.nsError,
    };
  });
}

export async function syncRegistrarDomains(input: { registrar: Registrar; accountId?: string }) {
  try {
    const items = await pullRegistrarDomainItems(input);
    const persisted = await syncRegistrarDomainsToStore(
      input.registrar as PersistedRegistrar,
      items,
    );
    return {
      domains: items.map((item) => item.domain),
      items,
      syncJob: persisted.job,
      persistedDomains: persisted.domains,
    };
  } catch (error) {
    const job = await recordRegistrarSyncFailure(input.registrar as PersistedRegistrar, error);
    throw Object.assign(error instanceof Error ? error : new Error("同步失败"), { syncJob: job });
  }
}
