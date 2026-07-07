import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, type ReactNode } from "react";
import {
  listNotificationCenter,
  type NotificationCenterItem,
  type NotificationKind,
  type NotificationSeverity,
} from "@/lib/notification-center.functions";
import { formatDate, formatDateTime } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  Globe2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "通知中心 · dshunter" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const listFn = useServerFn(listNotificationCenter);
  const q = useQuery({
    queryKey: ["notification-center"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });
  const items = useMemo(() => q.data?.items ?? [], [q.data?.items]);
  const summary = q.data?.summary;
  const tabs = useMemo(
    () => [
      { value: "all", label: "全部", items },
      {
        value: "critical",
        label: "紧急",
        items: items.filter((item) => item.severity === "critical"),
      },
      { value: "expiry", label: "到期", items: items.filter((item) => item.kind === "expiry") },
      { value: "dns", label: "DNS", items: items.filter((item) => item.kind === "dns") },
      { value: "sync", label: "同步", items: items.filter((item) => item.kind === "sync") },
    ],
    [items],
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">通知中心</h1>
          <p className="text-sm text-muted-foreground">
            汇总域名到期、注册商同步和 NS 风险，数据每分钟自动刷新。
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => q.refetch()}>
          <RefreshCw className={cn("size-3.5", q.isFetching && "animate-spin")} />
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="待处理"
          value={summary?.total ?? items.length}
          icon={<Bell className="size-4" />}
        />
        <MetricCard
          label="紧急"
          value={summary?.critical ?? 0}
          icon={<AlertTriangle className="size-4" />}
          tone="danger"
        />
        <MetricCard
          label="到期提醒"
          value={summary?.expiry ?? 0}
          icon={<Clock3 className="size-4" />}
          tone="warning"
        />
        <MetricCard
          label="DNS / 同步"
          value={(summary?.dns ?? 0) + (summary?.sync ?? 0)}
          icon={<ShieldAlert className="size-4" />}
          tone="primary"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <div className="font-display font-semibold">提醒队列</div>
            <div className="text-xs text-muted-foreground">
              {q.data?.generatedAt
                ? `生成于 ${formatDateTime(q.data.generatedAt)}`
                : "正在读取提醒"}
            </div>
          </div>
          <Badge variant="secondary">{items.length} 条</Badge>
        </div>

        <Tabs defaultValue="all" className="p-4">
          <TabsList className="h-auto min-h-9 max-w-full flex-wrap justify-start">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
                <span className="ml-1 font-mono text-[11px] tabular-nums">{tab.items.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <NotificationList items={tab.items} loading={q.isLoading} />
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone = "muted",
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "muted" | "danger" | "warning" | "primary";
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span
        className={cn(
          "grid size-9 place-items-center rounded-lg",
          tone === "danger" && "bg-destructive/12 text-destructive",
          tone === "warning" && "bg-warning/12 text-warning",
          tone === "primary" && "bg-primary/12 text-primary",
          tone === "muted" && "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}

function NotificationList({
  items,
  loading,
}: {
  items: NotificationCenterItem[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">正在加载通知…</div>;
  }
  if (items.length === 0) {
    return (
      <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-8 text-center">
        <div>
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <div className="mt-3 font-display font-semibold">暂无通知</div>
          <p className="mt-1 text-sm text-muted-foreground">当前没有到期、同步或 DNS 风险提醒。</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
      {items.map((item) => (
        <NotificationRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function NotificationRow({ item }: { item: NotificationCenterItem }) {
  return (
    <div className="grid gap-3 bg-card p-4 transition-colors hover:bg-muted/30 md:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("signal", severitySignal(item.severity))} />
          <Badge className={cn("text-[10px]", severityBadge(item.severity))}>
            {severityLabel(item.severity)}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {kindLabel(item.kind)}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">{item.domain}</span>
        </div>
        <div className="mt-2 font-medium">{item.title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Globe2 className="size-3" />
            {item.source === "manual" ? "手动域名" : (item.registrar ?? "注册商")}
          </span>
          {item.expiresAt && <span>到期日 {formatDate(item.expiresAt)}</span>}
          {typeof item.daysRemaining === "number" && (
            <span>
              {item.daysRemaining < 0
                ? `已过期 ${Math.abs(item.daysRemaining)} 天`
                : `剩余 ${item.daysRemaining} 天`}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center md:justify-end">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to={item.target}>
            {item.actionLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function severitySignal(severity: NotificationSeverity) {
  if (severity === "critical") return "signal-danger";
  if (severity === "warning") return "signal-warning";
  return "signal-primary";
}

function severityBadge(severity: NotificationSeverity) {
  if (severity === "critical") return "bg-destructive text-destructive-foreground";
  if (severity === "warning") return "bg-warning text-warning-foreground";
  return "bg-primary text-primary-foreground";
}

function severityLabel(severity: NotificationSeverity) {
  if (severity === "critical") return "紧急";
  if (severity === "warning") return "提醒";
  return "提示";
}

function kindLabel(kind: NotificationKind) {
  if (kind === "expiry") return "到期";
  if (kind === "dns") return "DNS";
  return "同步";
}
