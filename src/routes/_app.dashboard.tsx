import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getTokenStatus } from "@/lib/registrars.functions";
import { getCfHealth } from "@/lib/cloudflare.functions";
import { useDomains } from "@/lib/domain-store";
import { formatDateTime } from "@/lib/date-format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Globe,
  Link2,
  ListTree,
  Settings,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Boxes,
  Clock3,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "仪表盘 · dshunter" }] }),
  component: Dashboard,
});

const SOURCES: { key: string; label: string }[] = [
  { key: "cloudflare", label: "Cloudflare" },
  { key: "spaceship", label: "Spaceship" },
  { key: "dynadot", label: "Dynadot" },
  { key: "porkbun", label: "Porkbun" },
  { key: "namecheap", label: "Namecheap" },
  { key: "aliyun", label: "阿里云" },
  { key: "tencent", label: "腾讯云" },
  { key: "west", label: "西部数码" },
];

type LastPull = { source: string; count: number; cloudflareCount: number; at: string };

function Dashboard() {
  const tokenFn = useServerFn(getTokenStatus);
  const healthFn = useServerFn(getCfHealth);
  const tokens = useQuery({ queryKey: ["tokens"], queryFn: () => tokenFn() });
  const health = useQuery({ queryKey: ["cf-health"], queryFn: () => healthFn() });
  const workingSet = useDomains();

  const [lastPull, setLastPull] = useState<LastPull | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("domainops.lastPull");
      if (raw) setLastPull(JSON.parse(raw));
    } catch {
      // 忽略损坏的缓存
    }
  }, []);

  const configuredCount = tokens.data
    ? SOURCES.filter((s) => (tokens.data as any)[s.key]).length
    : null;
  const estimatedValue = "--";

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight mb-1">仪表盘</h1>
      <p className="text-sm text-muted-foreground mb-5">
        域名运营概览：来源配置、Cloudflare 接入与工作集状态。
      </p>

      {/* 关键指标 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5">
        <StatCard
          icon={<Boxes className="size-4" />}
          label="已配置来源"
          value={configuredCount === null ? "…" : `${configuredCount} / ${SOURCES.length}`}
          to="/settings"
        />
        <StatCard
          icon={<Globe className="size-4" />}
          label="Cloudflare Zone"
          value={
            health.isLoading
              ? "…"
              : health.data?.zoneCount != null
                ? String(health.data.zoneCount)
                : "—"
          }
          sub={
            health.data?.zoneCount != null && health.data.activeZones != null
              ? `${health.data.activeZones} 个已激活`
              : undefined
          }
          to="/domains"
        />
        <StatCard
          icon={<ListTree className="size-4" />}
          label="工作集域名"
          value={String(workingSet.length)}
          sub={workingSet.length > 0 ? "可直接批量绑定 / 解析" : "到域名列表选择"}
          to="/records"
        />
        <StatCard
          icon={<ShieldCheck className="size-4" />}
          label="估算价值"
          value={estimatedValue}
          sub="未接入 renewalPrice 时不展示假增量"
          to="/domains"
        />
        <StatCard
          icon={<Clock3 className="size-4" />}
          label="最近拉取"
          value={lastPull ? `${lastPull.count} 个` : "—"}
          sub={
            lastPull
              ? `${lastPull.source} · ${formatDateTime(lastPull.at)}`
              : "还没有拉取记录"
          }
          to="/domains"
        />
      </div>

      {/* Cloudflare 健康状态 */}
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {health.isLoading ? (
              <Badge variant="secondary">检测中…</Badge>
            ) : health.data?.tokenStatus === "active" && !health.data.error ? (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <ShieldCheck className="size-4" />
                Cloudflare Token 有效，Zone 读取正常
              </span>
            ) : health.data?.tokenStatus === "active" && health.data.error ? (
              <span className="flex items-center gap-1.5 text-sm text-amber-600">
                <ShieldAlert className="size-4" />
                Token 有效但权限不足
              </span>
            ) : health.data?.tokenStatus === "invalid" ? (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <ShieldAlert className="size-4" />
                Cloudflare Token 无效（verify 未通过）
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <KeyRound className="size-4" />
                Cloudflare Token 未配置
              </span>
            )}
          </div>
          {health.data && (health.data.tokenStatus !== "active" || health.data.error) && (
            <Button asChild size="sm" variant="outline">
              <Link to="/settings">
                <Settings className="mr-1 size-3.5" />
                去设置
              </Link>
            </Button>
          )}
        </div>
        {health.data?.error && (
          <p className="mt-2 text-xs text-destructive">{health.data.error}</p>
        )}
        {health.error && (
          <p className="mt-2 text-xs text-destructive">{(health.error as Error).message}</p>
        )}
      </Card>

      {/* 来源配置状态 */}
      <Card className="p-4 mb-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold">API 凭证状态</div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/settings">管理</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SOURCES.map((s) => {
            const ok = tokens.data ? Boolean((tokens.data as any)[s.key]) : undefined;
            return (
              <div
                key={s.key}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{s.label}</span>
                {ok === undefined ? (
                  <span className="text-xs text-muted-foreground">…</span>
                ) : ok ? (
                  <CheckCircle2 className="size-4 text-green-600" />
                ) : (
                  <XCircle className="size-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 快捷入口 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <QuickLink
          to="/domains"
          icon={<Globe className="size-5" />}
          title="域名列表"
          desc="拉取 / 合并 / 筛选域名"
        />
        <QuickLink
          to="/bind"
          icon={<Link2 className="size-5" />}
          title="批量绑定"
          desc="创建 Zone + 自动改 NS"
        />
        <QuickLink
          to="/records"
          icon={<ListTree className="size-5" />}
          title="解析记录"
          desc="单域名 + 批量 DNS 管理"
        />
        <QuickLink
          to="/settings"
          icon={<Settings className="size-5" />}
          title="设置"
          desc="API 凭证与主题"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-4 transition-colors hover:bg-accent/50">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
      </Card>
    </Link>
  );
}

function QuickLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to}>
      <Card className="flex flex-col gap-1.5 p-4 transition-colors hover:bg-accent">
        {icon}
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </Card>
    </Link>
  );
}
