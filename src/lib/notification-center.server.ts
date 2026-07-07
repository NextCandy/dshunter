import {
  listPersistedRegistrarDomains,
  type PersistedRegistrarDomain,
} from "./registrar-domain-store.server";
import { listManualDomains, type ManualDomain } from "./manual-domain-store.server";

export type NotificationKind = "expiry" | "dns" | "sync";
export type NotificationSeverity = "critical" | "warning" | "info";
export type NotificationTarget = "/domains" | "/manual";

export type NotificationCenterItem = {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  description: string;
  domain: string;
  source: "registrar" | "manual";
  registrar?: string;
  daysRemaining?: number;
  expiresAt?: string;
  target: NotificationTarget;
  actionLabel: string;
  createdAt: string;
};

export type NotificationSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  expiry: number;
  dns: number;
  sync: number;
};

export type NotificationCenterResult = {
  items: NotificationCenterItem[];
  summary: NotificationSummary;
  generatedAt: string;
};

const EXPIRY_WARNING_DAYS = 30;
const EXPIRY_CRITICAL_DAYS = 7;

export async function listNotificationCenter(): Promise<NotificationCenterResult> {
  const [registrarRows, manualRows] = await Promise.all([
    listPersistedRegistrarDomains(),
    listManualDomains(),
  ]);
  const generatedAt = new Date().toISOString();
  const items = [
    ...registrarRows.flatMap((row) => registrarNotifications(row, generatedAt)),
    ...manualRows.flatMap((row) => manualNotifications(row, generatedAt)),
  ].sort(sortNotifications);

  return {
    items: items.slice(0, 120),
    summary: summarize(items),
    generatedAt,
  };
}

function registrarNotifications(row: PersistedRegistrarDomain, now: string) {
  const items: NotificationCenterItem[] = [];
  const base = {
    domain: row.domain,
    source: "registrar" as const,
    registrar: row.registrar,
    target: "/domains" as const,
    actionLabel: "查看域名列表",
    createdAt: now,
  };

  const expiry = expiryNotification(row.domain, row.expiresAt, now, base);
  if (expiry) items.push(expiry);

  if (row.syncStatus === "missing") {
    items.push({
      ...base,
      id: `sync:missing:${row.id}`,
      kind: "sync",
      severity: "critical",
      title: `${row.domain} 已从注册商同步结果中消失`,
      description: "最近一次同步没有再返回该域名，请确认是否已转出、删除或 API 权限变化。",
    });
  } else if (row.syncStatus === "warning") {
    items.push({
      ...base,
      id: `sync:warning:${row.id}`,
      kind: "sync",
      severity: "warning",
      title: `${row.domain} 同步存在警告`,
      description: row.syncError || row.nsError || "注册商同步完成，但部分信息未能确认。",
    });
  }

  if (row.nsStatus === "other") {
    items.push({
      ...base,
      id: `dns:other:${row.id}`,
      kind: "dns",
      severity: "warning",
      title: `${row.domain} 未指向 Cloudflare NS`,
      description: row.nsProvider
        ? `当前 NS 托管识别为 ${row.nsProvider}，批量绑定前建议确认。`
        : "当前 NS 未识别为 Cloudflare，批量绑定前建议确认。",
    });
  }

  return items;
}

function manualNotifications(row: ManualDomain, now: string) {
  const base = {
    domain: row.domain,
    source: "manual" as const,
    registrar: row.registrar,
    target: "/manual" as const,
    actionLabel: "查看手动域名",
    createdAt: now,
  };
  const items: NotificationCenterItem[] = [];
  const expiry = expiryNotification(row.domain, row.expiresAt, now, base);
  if (expiry) items.push(expiry);
  if (row.nsStatus === "other") {
    items.push({
      ...base,
      id: `dns:manual:${row.id}`,
      kind: "dns",
      severity: "info",
      title: `${row.domain} 的 NS 不在 Cloudflare`,
      description: row.nsProvider
        ? `当前 NS 托管识别为 ${row.nsProvider}，如需托管到 Cloudflare 请进入解析记录处理。`
        : "当前 NS 未识别为 Cloudflare，如需托管到 Cloudflare 请进入解析记录处理。",
    });
  }
  return items;
}

function expiryNotification(
  domain: string,
  expiresAt: string | undefined,
  now: string,
  base: Pick<
    NotificationCenterItem,
    "source" | "registrar" | "target" | "actionLabel" | "createdAt"
  >,
): NotificationCenterItem | null {
  const daysRemaining = daysUntil(expiresAt);
  if (daysRemaining === undefined || daysRemaining > EXPIRY_WARNING_DAYS) return null;
  const expired = daysRemaining < 0;
  const severity: NotificationSeverity =
    expired || daysRemaining <= EXPIRY_CRITICAL_DAYS ? "critical" : "warning";
  const title = expired ? `${domain} 已过期` : `${domain} 将在 ${daysRemaining} 天后到期`;
  const description = expired
    ? `到期日已过去 ${Math.abs(daysRemaining)} 天，请尽快确认续费或转移状态。`
    : `到期日进入 ${EXPIRY_WARNING_DAYS} 天提醒窗口，请确认续费、自动续费和支付方式。`;

  return {
    ...base,
    id: `expiry:${domain}`,
    kind: "expiry",
    severity,
    title,
    description,
    domain,
    daysRemaining,
    expiresAt,
    createdAt: now,
  };
}

function daysUntil(expiresAt?: string) {
  if (!expiresAt) return undefined;
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return undefined;
  return Math.ceil((ms - Date.now()) / 86400000);
}

function summarize(items: NotificationCenterItem[]): NotificationSummary {
  return {
    total: items.length,
    critical: items.filter((item) => item.severity === "critical").length,
    warning: items.filter((item) => item.severity === "warning").length,
    info: items.filter((item) => item.severity === "info").length,
    expiry: items.filter((item) => item.kind === "expiry").length,
    dns: items.filter((item) => item.kind === "dns").length,
    sync: items.filter((item) => item.kind === "sync").length,
  };
}

function sortNotifications(a: NotificationCenterItem, b: NotificationCenterItem) {
  const severity = severityRank(a.severity) - severityRank(b.severity);
  if (severity !== 0) return severity;
  const aDays = a.daysRemaining ?? Number.POSITIVE_INFINITY;
  const bDays = b.daysRemaining ?? Number.POSITIVE_INFINITY;
  if (aDays !== bDays) return aDays - bDays;
  return a.domain.localeCompare(b.domain);
}

function severityRank(severity: NotificationSeverity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}
