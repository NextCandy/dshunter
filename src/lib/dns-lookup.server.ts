import {
  resolve4,
  resolve6,
  resolveCname,
  resolveMx,
  resolveTxt,
  resolveNs,
} from "node:dns/promises";
import {
  classifyNameservers,
  identifyNsProvider,
  type NameserverStatus,
} from "./nameservers.server";

export type DnsRecordSet = {
  A: string[];
  AAAA: string[];
  CNAME: string[];
  MX: string[];
  TXT: string[];
  NS: string[];
};

export type DomainDnsLookup = {
  domain: string;
  nameservers: string[];
  nsStatus: NameserverStatus;
  nsProvider?: string;
  /** 当前 NS 托管商的 DNS 管理台入口（非 Cloudflare 时用于"去修改 DNS"外链） */
  managerUrl?: string;
  records: DnsRecordSet;
  recordCount: number;
  error?: string;
};

// 托管商 → DNS 管理台入口。多为通用入口（无法直连到具体域名），够用户跳转到对应后台。
const PROVIDER_CONSOLE: Record<string, string> = {
  Cloudflare: "https://dash.cloudflare.com/",
  Porkbun: "https://porkbun.com/account/domainsSpeedy",
  Spaceship: "https://www.spaceship.com/application/advanced-dns-application/",
  Dynadot: "https://www.dynadot.com/account/domain/setting/dns",
  Namecheap: "https://ap.www.namecheap.com/Domains/DomainControlPanel",
  阿里云: "https://dns.console.aliyun.com/",
  "DNSPod/腾讯": "https://console.dnspod.cn/dns/list",
  西部数码: "https://www.west.cn/manager/domain/domainlist.asp",
  NameSilo: "https://www.namesilo.com/account_domains.php",
  GoDaddy: "https://dcc.godaddy.com/control/dnsmanagement",
  Google: "https://domains.google.com/registrar",
  Route53: "https://console.aws.amazon.com/route53/v2/hostedzones",
  Vercel: "https://vercel.com/dashboard/domains",
};

export function dnsManagerUrl(provider?: string): string | undefined {
  return provider ? PROVIDER_CONSOLE[provider] : undefined;
}

function cleanHost(ns: string) {
  return ns.trim().replace(/\.$/, "").toLowerCase();
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DNS 查询超时")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// 某一类型无记录会抛 ENODATA/ENOTFOUND，逐类型独立兜底，不影响其它类型。
async function safeResolve<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await withTimeout(p, 4000);
  } catch {
    return null;
  }
}

export async function lookupDomainDnsRecords(domainRaw: string): Promise<DomainDnsLookup> {
  const domain = cleanHost(domainRaw);

  const [a, aaaa, cname, mx, txt, ns] = await Promise.all([
    safeResolve(resolve4(domain)),
    safeResolve(resolve6(domain)),
    safeResolve(resolveCname(domain)),
    safeResolve(resolveMx(domain)),
    safeResolve(resolveTxt(domain)),
    safeResolve(resolveNs(domain)),
  ]);

  const nameservers = (ns ?? []).map(cleanHost).filter(Boolean).sort();

  const records: DnsRecordSet = {
    A: a ?? [],
    AAAA: aaaa ?? [],
    CNAME: (cname ?? []).map(cleanHost),
    MX: (mx ?? [])
      .map((m) => `${m.priority} ${cleanHost(m.exchange)}`)
      .sort((x, y) => x.localeCompare(y)),
    TXT: (txt ?? []).map((chunks) => chunks.join("")),
    NS: nameservers,
  };

  const recordCount =
    records.A.length +
    records.AAAA.length +
    records.CNAME.length +
    records.MX.length +
    records.TXT.length +
    records.NS.length;

  const nsProvider = identifyNsProvider(nameservers);
  const nsStatus = classifyNameservers(nameservers);

  return {
    domain,
    nameservers,
    nsStatus,
    nsProvider,
    managerUrl: dnsManagerUrl(nsProvider),
    records,
    recordCount,
    error:
      recordCount === 0
        ? "未查询到任何公开 DNS 记录（域名可能未解析、不存在或被限制查询）"
        : undefined,
  };
}
