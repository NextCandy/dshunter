import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  getTokenStatus,
  listPersistedDomains,
  listRegistrarDomains,
  listRegistrarSyncJobs,
  type Registrar,
} from "@/lib/registrars.functions";
import type {
  PersistedRegistrar,
  PersistedRegistrarDomain,
  RegistrarSyncJob,
} from "@/lib/registrar-domain-store.server";
import { listZones } from "@/lib/cloudflare.functions";
import { setDomains } from "@/lib/domain-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowDownUp,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  FileDown,
  Grid2X2,
  Import,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Tag,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_app/domains")({
  head: () => ({ meta: [{ title: "域名管理 · DS Hunter" }] }),
  component: DomainsPage,
});

type AssetStatus = "normal" | "expiring" | "expired" | "error" | "unknown";
type DetailTab = "overview" | "dns" | "contact" | "security" | "logs";
type SortKey = "expiresAt" | "daysRemaining" | "estimatedValue";
type SortDir = "asc" | "desc";
type MoreFilter = "all" | "favorite" | "missing" | "unknown-expiry";
type RegistrarAccount = {
  key: string;
  label: string;
  tokenKey: string;
  registrar?: Registrar;
  supported: boolean;
};
type TokenStatus = Record<string, boolean | undefined>;
type DomainAsset = {
  id: string;
  domain: string;
  registrar: PersistedRegistrar | "cloudflare-zone" | "unknown";
  registrarLabel: string;
  status: AssetStatus;
  registeredAt?: string;
  expiresAt?: string;
  daysRemaining?: number;
  group?: string;
  tags: string[];
  estimatedValue?: number;
  favorite: boolean;
  autoRenew?: boolean;
  domainLock?: boolean;
  privacyProtection?: boolean;
  note?: string;
  nameservers: string[];
  nsStatus: "cloudflare" | "other" | "unknown";
  nsProvider?: string;
  nsError?: string;
  syncStatus: "ok" | "missing" | "warning";
  lastSyncedAt?: string;
  updatedAt?: string;
  isDemo?: boolean;
};

const REGISTRARS: RegistrarAccount[] = [
  { key: "aliyun", label: "阿里云", tokenKey: "aliyun", registrar: "aliyun", supported: true },
  { key: "tencent", label: "腾讯云", tokenKey: "tencent", registrar: "tencent", supported: true },
  { key: "west", label: "西部数码", tokenKey: "west", registrar: "west", supported: true },
  {
    key: "cloudflare",
    label: "Cloudflare",
    tokenKey: "cloudflare",
    registrar: "cf-registrar",
    supported: true,
  },
  { key: "godaddy", label: "GoDaddy", tokenKey: "godaddy", supported: false },
  { key: "namesilo", label: "NameSilo", tokenKey: "namesilo", supported: false },
];

const DEMO_ASSETS: DomainAsset[] = [
  demoAsset("dshunter.com", "aliyun", "阿里云", 357, "主站", ["核心"], 12800, true),
  demoAsset("dshunter.net", "tencent", "腾讯云", 291, "主站", ["品牌"], 5600, false),
  demoAsset("dshunter.app", "west", "西部数码", 227, "产品", ["移动"], 8900, false),
  demoAsset("dshunter.io", "cloudflare-zone", "Cloudflare", 7, "产品", ["出海"], 18600, true),
  demoAsset("hunterds.com", "aliyun", "阿里云", 39, "备用", ["保护"], 3200, false),
  demoAsset("dshunter.cn", "west", "西部数码", -38, "备用", ["中文"], 1200, false),
  demoAsset("dshunter.co", "unknown", "GoDaddy", 447, "投资", ["精品"], 7800, false),
  demoAsset("tool.dshunter.com", "tencent", "腾讯云", 532, "工具", ["DNS"], 2900, false),
  demoAsset("shop.dshunter.com", "aliyun", "阿里云", 275, "电商", ["业务"], 4500, false),
  demoAsset(
    "blog.dshunter.com",
    "cloudflare-zone",
    "Cloudflare",
    369,
    "内容",
    ["SEO"],
    1600,
    false,
  ),
];

function DomainsPage() {
  const router = useRouter();
  const tokensFn = useServerFn(getTokenStatus);
  const listFn = useServerFn(listRegistrarDomains);
  const persistedFn = useServerFn(listPersistedDomains);
  const jobsFn = useServerFn(listRegistrarSyncJobs);
  const zonesFn = useServerFn(listZones);

  const tokens = useQuery({ queryKey: ["tokens"], queryFn: () => tokensFn() });
  const persistedAssets = useQuery({
    queryKey: ["persisted-registrar-domains"],
    queryFn: () => persistedFn() as Promise<{ rows: PersistedRegistrarDomain[] }>,
  });
  const syncJobs = useQuery({
    queryKey: ["registrar-sync-jobs"],
    queryFn: () => jobsFn() as Promise<{ rows: RegistrarSyncJob[] }>,
  });

  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [registrarFilter, setRegistrarFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [moreFilter, setMoreFilter] = useState<MoreFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("expiresAt");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [jumpPage, setJumpPage] = useState("1");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [draft, setDraft] = useState({ group: "", tags: "", note: "", estimatedValue: "" });

  const realRows = useMemo(() => persistedAssets.data?.rows ?? [], [persistedAssets.data?.rows]);
  const assets = useMemo(
    () => (realRows.length > 0 ? realRows.map(toAsset) : DEMO_ASSETS),
    [realRows],
  );
  const hasRealData = realRows.length > 0;
  const tokenPresence: TokenStatus = tokens.data ?? {};
  const lastSyncAt = newestDate(
    syncJobs.data?.rows?.map((job) => job.finishedAt) ?? assets.map((a) => a.lastSyncedAt),
  );

  const selectedAsset = assets.find((asset) => asset.id === selectedId) ?? assets[0] ?? null;

  useEffect(() => {
    if (!selectedAsset) return;
    setSelectedId((current) => current ?? selectedAsset.id);
  }, [selectedAsset]);

  useEffect(() => {
    if (!selectedAsset) return;
    setDraft({
      group: selectedAsset.group ?? "",
      tags: selectedAsset.tags.join(", "),
      note: selectedAsset.note ?? "",
      estimatedValue:
        typeof selectedAsset.estimatedValue === "number"
          ? String(selectedAsset.estimatedValue)
          : "",
    });
  }, [selectedAsset]);

  const groups = useMemo(
    () => [...new Set(assets.map((asset) => asset.group).filter(Boolean) as string[])].sort(),
    [assets],
  );
  const registrars = useMemo(
    () => [...new Set(assets.map((asset) => asset.registrarLabel).filter(Boolean))].sort(),
    [assets],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = assets.filter((asset) => {
      if (
        needle &&
        ![asset.domain, asset.registrarLabel, asset.note, asset.group, asset.tags.join(" ")]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      ) {
        return false;
      }
      if (groupFilter !== "all" && asset.group !== groupFilter) return false;
      if (registrarFilter !== "all" && asset.registrarLabel !== registrarFilter) return false;
      if (statusFilter !== "all" && asset.status !== statusFilter) return false;
      if (moreFilter === "favorite" && !asset.favorite) return false;
      if (moreFilter === "missing" && asset.syncStatus !== "missing") return false;
      if (moreFilter === "unknown-expiry" && asset.expiresAt) return false;
      return true;
    });
    return next.sort((a, b) => compareAssets(a, b, sortKey, sortDir));
  }, [assets, query, groupFilter, registrarFilter, statusFilter, moreFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const stats = useMemo(() => makeStats(assets), [assets]);

  useEffect(() => {
    setPage(1);
  }, [query, groupFilter, registrarFilter, statusFilter, moreFilter, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
    setJumpPage(String(Math.min(page, pageCount)));
  }, [page, pageCount]);

  const sync = useMutation({
    mutationFn: async (account: RegistrarAccount) => {
      if (!account.supported) throw new Error(`${account.label} 暂未接入`);
      if (!tokenPresence[account.tokenKey]) throw new Error(`${account.label} 未配置 API 凭证`);
      if (account.key === "cloudflare") {
        const zones = await zonesFn();
        return { account, count: zones.zones?.length ?? 0, cloudflareOnly: true };
      }
      if (!account.registrar) throw new Error(`${account.label} 暂未接入`);
      const result = await listFn({ data: { registrar: account.registrar } });
      return { account, count: result.domains.length, cloudflareOnly: false };
    },
    onSuccess: async ({ account, count, cloudflareOnly }) => {
      if (!cloudflareOnly) {
        await Promise.all([persistedAssets.refetch(), syncJobs.refetch()]);
      }
      toast.success(`${account.label} 同步完成：${count} 个域名`);
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "同步失败"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/registrar-domains/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      return json;
    },
    onSuccess: async () => {
      await persistedAssets.refetch();
      toast.success("资产信息已保存");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "保存失败"),
  });

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(pageRows.map((asset) => asset.id)) : new Set());
  }

  function toggleSelected(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  }

  function saveSelectedAsset() {
    if (!selectedAsset || selectedAsset.isDemo) {
      toast.info("当前是示例空状态，连接注册商后可保存真实资产字段");
      return;
    }
    patch.mutate({
      id: selectedAsset.id,
      body: {
        group: draft.group || null,
        tags: draft.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        note: draft.note || null,
        estimatedValue: draft.estimatedValue ? Number(draft.estimatedValue) : null,
      },
    });
  }

  function toggleFavorite(asset: DomainAsset) {
    if (asset.isDemo) {
      toast.info("当前是示例空状态，连接注册商后可收藏真实域名");
      return;
    }
    patch.mutate({ id: asset.id, body: { favorite: !asset.favorite } });
  }

  function resetFilters() {
    setQuery("");
    setGroupFilter("all");
    setRegistrarFilter("all");
    setStatusFilter("all");
    setMoreFilter("all");
    setSortKey("expiresAt");
    setSortDir("asc");
  }

  function saveView() {
    try {
      localStorage.setItem(
        "dshunter.domainView",
        JSON.stringify({
          groupFilter,
          registrarFilter,
          statusFilter,
          moreFilter,
          sortKey,
          sortDir,
        }),
      );
      toast.success("视图已保存到当前浏览器");
    } catch {
      toast.error("当前浏览器不允许保存视图");
    }
  }

  async function openDns(domain: string) {
    setDomains([domain]);
    await router.navigate({ to: "/records" });
  }

  return (
    <div className="min-h-full p-3 sm:p-4 xl:p-5">
      <div className="grid min-h-[calc(100vh-98px)] gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <section className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <StatCard label="域名总数" value={stats.total} change="+38" tone="primary" />
            <StatCard label="活跃域名" value={stats.active} change="+27" tone="success" />
            <StatCard label="即将到期" value={stats.expiring} change="-3" tone="warning" />
            <StatCard label="已过期" value={stats.expired} change="-1" tone="danger" />
            <StatCard label="监控中" value={stats.monitored} change="+11" tone="success" />
            <StatCard
              label="预估价值"
              value={formatCurrency(stats.value)}
              change="+56,789"
              tone="success"
            />
          </div>

          <div className="ds-terminal-panel rounded-md p-3">
            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold">注册商连接状态</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  上次全量同步时间：{lastSyncAt ? formatDateTime(lastSyncAt) : "未知 / 未获取"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const first = REGISTRARS.find(
                      (account) => account.supported && Boolean(tokenPresence[account.tokenKey]),
                    );
                    if (first) sync.mutate(first);
                    else toast.info("请先配置注册商 API 凭证");
                  }}
                  disabled={sync.isPending}
                  className="rounded-md"
                >
                  {sync.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  立即同步
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-md">
                  <Link to="/settings">
                    <Plus className="size-3.5" />
                    添加注册商
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              {REGISTRARS.map((account) => {
                const configured = Boolean(tokenPresence[account.tokenKey]);
                const rows = assets.filter((asset) => registrarMatches(account, asset));
                return (
                  <button
                    key={account.key}
                    type="button"
                    disabled={!account.supported || !configured || sync.isPending}
                    onClick={() => sync.mutate(account)}
                    className="rounded-md border border-border bg-secondary/35 p-3 text-left transition hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{account.label}</span>
                      {configured ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : account.supported ? (
                        <Bell className="size-4 text-muted-foreground" />
                      ) : (
                        <X className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="mt-2 text-[11px]">
                      {configured ? (
                        <span className="rounded bg-success/15 px-1.5 py-0.5 text-success">
                          已连接
                        </span>
                      ) : account.supported ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                          未配置
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                          待接入
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {rows.length ? `${rows.length.toLocaleString()} 个资产` : "未知 / 未获取"}
                    </div>
                  </button>
                );
              })}
              <Link
                to="/settings"
                className="flex min-h-[92px] flex-col items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="mb-1 size-6" />
                添加注册商
              </Link>
            </div>
          </div>

          <div className="ds-terminal-panel overflow-hidden rounded-md">
            {!hasRealData && (
              <div className="border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                当前没有真实持久化域名，表格展示为示例空状态；同步注册商后会自动切换到真实数据。
              </div>
            )}

            <div className="border-b border-border p-3">
              <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_140px_150px_130px_120px_auto_auto]">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="输入域名关键词搜索"
                    className="h-9 rounded-md bg-background pl-9 text-sm"
                  />
                </label>
                <SelectBox value={groupFilter} onChange={setGroupFilter}>
                  <option value="all">全部分组</option>
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </SelectBox>
                <SelectBox value={registrarFilter} onChange={setRegistrarFilter}>
                  <option value="all">全部注册商</option>
                  {registrars.map((registrar) => (
                    <option key={registrar} value={registrar}>
                      {registrar}
                    </option>
                  ))}
                </SelectBox>
                <SelectBox value={statusFilter} onChange={setStatusFilter}>
                  <option value="all">全部状态</option>
                  <option value="normal">正常</option>
                  <option value="expiring">即将到期</option>
                  <option value="expired">已过期</option>
                  <option value="error">异常</option>
                  <option value="unknown">未知</option>
                </SelectBox>
                <SelectBox
                  value={moreFilter}
                  onChange={(value) => setMoreFilter(value as MoreFilter)}
                >
                  <option value="all">更多筛选</option>
                  <option value="favorite">仅收藏</option>
                  <option value="missing">同步缺失</option>
                  <option value="unknown-expiry">到期未知</option>
                </SelectBox>
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  <RotateCcw className="size-3.5" />
                  重置
                </Button>
                <Button size="sm" variant="outline" onClick={saveView}>
                  <Save className="size-3.5" />
                  保存视图
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Checkbox
                  checked={
                    pageRows.length > 0 && pageRows.every((asset) => selectedIds.has(asset.id))
                  }
                  onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                  aria-label="选择当前页"
                />
                <span className="text-muted-foreground">已选择 {selectedIds.size} 项</span>
                {[
                  ["续费", TimerIcon],
                  ["解析", SlidersHorizontal],
                  ["分组", Grid2X2],
                  ["标签", Tag],
                  ["更多", MoreHorizontal],
                ].map(([label, Icon]) => (
                  <Button
                    key={label as string}
                    size="sm"
                    variant="secondary"
                    disabled={selectedIds.size === 0}
                    onClick={() =>
                      label === "解析" && selectedAsset
                        ? openDns(selectedAsset.domain)
                        : toast.info("该批量能力待接入注册商开放接口")
                    }
                  >
                    <Icon className="size-3.5" />
                    {label as string}
                  </Button>
                ))}
                <div className="ml-auto flex flex-wrap gap-2">
                  {[
                    "Sync",
                    "Import",
                    "Transfer",
                    "Renew",
                    "DNS Check",
                    "Create Report",
                    "Customize",
                  ].map((action, index) => (
                    <Button
                      key={action}
                      size="sm"
                      variant={index === 0 ? "default" : "outline"}
                      onClick={() =>
                        action === "Sync"
                          ? REGISTRARS.find(
                              (account) => account.supported && tokenPresence[account.tokenKey],
                            ) &&
                            sync.mutate(
                              REGISTRARS.find(
                                (account) => account.supported && tokenPresence[account.tokenKey],
                              )!,
                            )
                          : action === "Import"
                            ? router.navigate({ to: "/settings" })
                            : action === "DNS Check" && selectedAsset
                              ? openDns(selectedAsset.domain)
                              : toast.info("该操作待接入注册商开放接口")
                      }
                    >
                      {action}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="ds-scrollbar overflow-auto">
              <table className="w-full min-w-[1120px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="w-9 px-3 py-2"></th>
                    <th className="w-9 px-2 py-2"></th>
                    <th className="px-3 py-2 font-medium">域名</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="px-3 py-2 font-medium">注册商</th>
                    <th className="px-3 py-2 font-medium">注册日期</th>
                    <SortableHead
                      label="到期日期"
                      active={sortKey === "expiresAt"}
                      dir={sortDir}
                      onClick={() =>
                        toggleSort("expiresAt", sortKey, sortDir, setSortKey, setSortDir)
                      }
                    />
                    <SortableHead
                      label="剩余天数"
                      active={sortKey === "daysRemaining"}
                      dir={sortDir}
                      onClick={() =>
                        toggleSort("daysRemaining", sortKey, sortDir, setSortKey, setSortDir)
                      }
                    />
                    <th className="px-3 py-2 font-medium">分组</th>
                    <th className="px-3 py-2 font-medium">标签</th>
                    <SortableHead
                      label="预估价值"
                      active={sortKey === "estimatedValue"}
                      dir={sortDir}
                      onClick={() =>
                        toggleSort("estimatedValue", sortKey, sortDir, setSortKey, setSortDir)
                      }
                    />
                    <th className="px-3 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((asset) => (
                    <tr
                      key={asset.id}
                      onClick={() => setSelectedId(asset.id)}
                      className={`cursor-pointer border-b border-border/80 hover:bg-secondary/55 ${
                        selectedAsset?.id === asset.id ? "bg-primary/8" : ""
                      }`}
                    >
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(asset.id)}
                          onCheckedChange={(checked) => toggleSelected(asset.id, Boolean(checked))}
                          aria-label={`选择 ${asset.domain}`}
                        />
                      </td>
                      <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(asset)}
                          aria-label={`收藏 ${asset.domain}`}
                          className="text-muted-foreground hover:text-warning"
                        >
                          <Star
                            className={`size-4 ${
                              asset.favorite ? "fill-warning text-warning" : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{asset.domain}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          更新 {asset.updatedAt ? formatDate(asset.updatedAt) : "未知"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={asset.status} />
                      </td>
                      <td className="px-3 py-2">{asset.registrarLabel}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDate(asset.registeredAt)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDate(asset.expiresAt)}
                      </td>
                      <td className={`px-3 py-2 font-mono ${daysClass(asset.daysRemaining)}`}>
                        {formatDays(asset.daysRemaining)}
                      </td>
                      <td className="px-3 py-2">
                        {asset.group ? <Badge variant="secondary">{asset.group}</Badge> : "未知"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex max-w-[170px] flex-wrap gap-1">
                          {asset.tags.length ? (
                            asset.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">未知</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {asset.estimatedValue == null
                          ? "未知"
                          : formatCurrency(asset.estimatedValue)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <IconAction label="查看" onClick={() => setSelectedId(asset.id)}>
                            <Eye className="size-4" />
                          </IconAction>
                          <IconAction label="编辑" onClick={() => setSelectedId(asset.id)}>
                            <Edit3 className="size-4" />
                          </IconAction>
                          <IconAction label="更多" onClick={() => toast.info("更多操作待接入")}>
                            <MoreHorizontal className="size-4" />
                          </IconAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                        当前筛选没有匹配域名
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-border px-3 py-3 text-xs text-muted-foreground lg:flex-row lg:items-center">
              <div>共 {filtered.length.toLocaleString()} 条</div>
              <div className="flex items-center gap-2">
                <span>每页</span>
                <SelectBox
                  value={String(pageSize)}
                  onChange={(value) => setPageSize(Number(value))}
                  className="h-8 w-24"
                >
                  <option value="10">10 条</option>
                  <option value="20">20 条</option>
                  <option value="50">50 条</option>
                </SelectBox>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {[1, 2, 3, 4, 5]
                  .filter((n) => n <= pageCount)
                  .map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={page === n ? "default" : "ghost"}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </Button>
                  ))}
                {pageCount > 5 && <span className="px-2">…</span>}
                {pageCount > 5 && (
                  <Button
                    size="sm"
                    variant={page === pageCount ? "default" : "ghost"}
                    onClick={() => setPage(pageCount)}
                  >
                    {pageCount}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= pageCount}
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <span className="ml-2">跳至</span>
                <Input
                  value={jumpPage}
                  onChange={(event) => setJumpPage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      const next = clamp(Number(jumpPage), 1, pageCount);
                      setPage(next);
                    }
                  }}
                  className="h-8 w-16 text-center"
                />
                <span>页</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="ds-terminal-panel min-w-0 rounded-md xl:sticky xl:top-4 xl:h-[calc(100vh-98px)]">
          {selectedAsset ? (
            <div className="flex h-full min-h-[640px] flex-col">
              <div className="border-b border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{selectedAsset.domain}</div>
                    <StatusBadge status={selectedAsset.status} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="关闭详情"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-1 text-xs">
                  {[
                    ["overview", "概览"],
                    ["dns", "DNS"],
                    ["contact", "联系信息"],
                    ["security", "安全"],
                    ["logs", "操作日志"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDetailTab(key as DetailTab)}
                      className={`border-b px-1 py-2 ${
                        detailTab === key
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ds-scrollbar min-h-0 flex-1 overflow-auto p-4">
                {detailTab === "overview" && (
                  <div className="space-y-4">
                    <InfoField label="域名" value={selectedAsset.domain} copyable />
                    <InfoField label="状态" value={statusLabel(selectedAsset.status)} />
                    <InfoField label="注册商" value={selectedAsset.registrarLabel} />
                    <InfoField label="注册日期" value={formatDate(selectedAsset.registeredAt)} />
                    <InfoField label="到期日期" value={formatDate(selectedAsset.expiresAt)} />
                    <InfoField label="剩余天数" value={formatDays(selectedAsset.daysRemaining)} />
                    <InfoField label="自动续费" value={booleanText(selectedAsset.autoRenew)} />
                    <InfoField label="域名锁定" value={booleanText(selectedAsset.domainLock)} />
                    <InfoField
                      label="隐私保护"
                      value={booleanText(selectedAsset.privacyProtection)}
                    />
                    <EditableFields
                      draft={draft}
                      onChange={setDraft}
                      onSave={saveSelectedAsset}
                      saving={patch.isPending}
                      disabled={Boolean(selectedAsset.isDemo)}
                    />
                  </div>
                )}

                {detailTab === "dns" && (
                  <div className="space-y-4">
                    <InfoField
                      label="DNS 服务器"
                      value={
                        selectedAsset.nameservers.length
                          ? selectedAsset.nameservers.join(" / ")
                          : "未知 / 未获取"
                      }
                      copyable={selectedAsset.nameservers.length > 0}
                    />
                    <InfoField
                      label="最后解析时间"
                      value={
                        selectedAsset.lastSyncedAt
                          ? formatDateTime(selectedAsset.lastSyncedAt)
                          : "未知 / 未获取"
                      }
                    />
                    {selectedAsset.nsError && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                        {selectedAsset.nsError}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDns(selectedAsset.domain)}
                    >
                      <RefreshCw className="size-3.5" />
                      刷新
                    </Button>
                  </div>
                )}

                {detailTab === "contact" && (
                  <EmptyDetail
                    title="联系信息"
                    text="注册商 API 暂未返回联系人字段，当前显示未知 / 未获取。"
                  />
                )}
                {detailTab === "security" && (
                  <div className="space-y-3">
                    <InfoField label="域名锁定" value={booleanText(selectedAsset.domainLock)} />
                    <InfoField
                      label="隐私保护"
                      value={booleanText(selectedAsset.privacyProtection)}
                    />
                    <InfoField label="同步状态" value={syncStatusText(selectedAsset.syncStatus)} />
                  </div>
                )}
                {detailTab === "logs" && (
                  <div className="space-y-2 text-xs">
                    <LogLine label="首次发现" value={formatDateTime(selectedAsset.updatedAt)} />
                    <LogLine label="最后同步" value={formatDateTime(selectedAsset.lastSyncedAt)} />
                    <LogLine label="同步状态" value={syncStatusText(selectedAsset.syncStatus)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-border p-4">
                <Button variant="outline" onClick={() => setSelectedId(null)}>
                  关闭
                </Button>
                <Button onClick={() => toast.info("续费操作待接入注册商开放接口")}>续费</Button>
                <Button variant="outline" onClick={() => openDns(selectedAsset.domain)}>
                  管理域名
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
              请选择一个域名查看详情
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function demoAsset(
  domain: string,
  registrar: DomainAsset["registrar"],
  registrarLabel: string,
  daysRemaining: number,
  group: string,
  tags: string[],
  estimatedValue: number,
  favorite: boolean,
): DomainAsset {
  const expires = new Date(Date.UTC(2026, 4, 20));
  expires.setUTCDate(expires.getUTCDate() + (daysRemaining - 357));
  return {
    id: `demo-${domain}`,
    domain,
    registrar,
    registrarLabel,
    status: statusFromDays(daysRemaining),
    registeredAt: "2020-05-20T00:00:00.000Z",
    expiresAt: expires.toISOString(),
    daysRemaining,
    group,
    tags,
    estimatedValue,
    favorite,
    autoRenew: daysRemaining > 0,
    domainLock: daysRemaining > 0,
    privacyProtection: daysRemaining > 0,
    note: domain === "dshunter.com" ? "公司主站域名，主要用于官网业务" : undefined,
    nameservers: ["dns1.alidns.com", "dns2.alidns.com"],
    nsStatus: registrarLabel === "Cloudflare" ? "cloudflare" : "other",
    syncStatus: daysRemaining < 0 ? "warning" : "ok",
    lastSyncedAt: "2025-05-28T09:15:22.000Z",
    updatedAt: "2025-05-28T09:15:22.000Z",
    isDemo: true,
  };
}

function toAsset(row: PersistedRegistrarDomain): DomainAsset {
  const days =
    typeof row.daysRemaining === "number"
      ? row.daysRemaining
      : calculateDaysRemaining(row.expiresAt);
  return {
    id: row.id,
    domain: row.domain,
    registrar: row.registrar,
    registrarLabel: registrarLabel(row.registrar),
    status: row.status ?? statusFromDays(days),
    registeredAt: row.registeredAt,
    expiresAt: row.expiresAt,
    daysRemaining: days,
    group: row.group,
    tags: row.tags ?? [],
    estimatedValue: row.estimatedValue,
    favorite: Boolean(row.favorite),
    autoRenew: row.autoRenew,
    domainLock: row.domainLock,
    privacyProtection: row.privacyProtection,
    note: row.note,
    nameservers: row.nameservers ?? [],
    nsStatus: row.nsStatus ?? "unknown",
    nsProvider: row.nsProvider,
    nsError:
      row.syncStatus === "missing" ? "注册商本次同步未返回，已保留并标记为缺失" : row.nsError,
    syncStatus: row.syncStatus,
    lastSyncedAt: row.lastSyncedAt,
    updatedAt: row.updatedAt,
  };
}

function StatCard({
  label,
  value,
  change,
  tone,
}: {
  label: string;
  value: number | string;
  change: string;
  tone: "primary" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-primary";
  return (
    <div className="ds-terminal-panel rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        较昨日
        <span className={toneClass}>{change}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AssetStatus }) {
  const meta = statusMeta(status);
  return <Badge className={`${meta.className} hover:${meta.className}`}>{meta.label}</Badge>;
}

function SelectBox({
  value,
  onChange,
  className = "h-9",
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-md border border-input bg-background px-3 text-sm text-foreground ${className}`}
    >
      {children}
    </select>
  );
}

function SortableHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${active ? "text-primary" : "text-muted-foreground"}`}
      >
        {label}
        <ArrowDownUp className={`size-3.5 ${active && dir === "desc" ? "rotate-180" : ""}`} />
      </button>
    </th>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function InfoField({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-start gap-3 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 break-words">{value || "未知 / 未获取"}</span>
        {copyable && value && (
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("已复制"))}
            className="shrink-0 text-muted-foreground hover:text-primary"
            aria-label={`复制${label}`}
          >
            <Copy className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function EditableFields({
  draft,
  onChange,
  onSave,
  saving,
  disabled,
}: {
  draft: { group: string; tags: string; note: string; estimatedValue: string };
  onChange: (next: { group: string; tags: string; note: string; estimatedValue: string }) => void;
  onSave: () => void;
  saving: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/25 p-3">
      <Input
        value={draft.group}
        onChange={(event) => onChange({ ...draft, group: event.target.value })}
        placeholder="分组"
        disabled={disabled}
      />
      <Input
        value={draft.tags}
        onChange={(event) => onChange({ ...draft, tags: event.target.value })}
        placeholder="标签，使用逗号分隔"
        disabled={disabled}
      />
      <Input
        value={draft.estimatedValue}
        type="number"
        min={0}
        onChange={(event) => onChange({ ...draft, estimatedValue: event.target.value })}
        placeholder="预估价值"
        disabled={disabled}
      />
      <textarea
        value={draft.note}
        onChange={(event) => onChange({ ...draft, note: event.target.value })}
        placeholder="备注"
        disabled={disabled}
        className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Button size="sm" onClick={onSave} disabled={saving || disabled}>
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        保存
      </Button>
    </div>
  );
}

function EmptyDetail({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-sm">
      <div className="font-medium">{title}</div>
      <p className="mt-2 text-muted-foreground">{text}</p>
    </div>
  );
}

function LogLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/25 p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono">{value}</div>
    </div>
  );
}

function TimerIcon(props: React.ComponentProps<"svg">) {
  return <RefreshCw {...props} />;
}

function makeStats(assets: DomainAsset[]) {
  return {
    total: assets.length,
    active: assets.filter((asset) => asset.status === "normal").length,
    expiring: assets.filter((asset) => asset.status === "expiring").length,
    expired: assets.filter((asset) => asset.status === "expired").length,
    monitored: assets.filter((asset) => asset.nsStatus !== "unknown").length,
    value: assets.reduce((sum, asset) => sum + (asset.estimatedValue ?? 0), 0),
  };
}

function compareAssets(a: DomainAsset, b: DomainAsset, sortKey: SortKey, sortDir: SortDir) {
  const multiplier = sortDir === "asc" ? 1 : -1;
  if (sortKey === "expiresAt") {
    return (
      ((a.expiresAt ? Date.parse(a.expiresAt) : Number.POSITIVE_INFINITY) -
        (b.expiresAt ? Date.parse(b.expiresAt) : Number.POSITIVE_INFINITY)) *
      multiplier
    );
  }
  return (
    (((a[sortKey] as number | undefined) ?? Number.POSITIVE_INFINITY) -
      ((b[sortKey] as number | undefined) ?? Number.POSITIVE_INFINITY)) *
    multiplier
  );
}

function toggleSort(
  key: SortKey,
  current: SortKey,
  dir: SortDir,
  setKey: (key: SortKey) => void,
  setDir: (dir: SortDir) => void,
) {
  if (key === current) setDir(dir === "asc" ? "desc" : "asc");
  else {
    setKey(key);
    setDir(key === "expiresAt" ? "asc" : "desc");
  }
}

function registrarMatches(account: RegistrarAccount, asset: DomainAsset) {
  if (account.key === "cloudflare") return asset.registrarLabel === "Cloudflare";
  return asset.registrar === account.key || asset.registrarLabel === account.label;
}

function registrarLabel(registrar: PersistedRegistrar | "cloudflare-zone" | "unknown") {
  const labels: Record<string, string> = {
    spaceship: "Spaceship",
    dynadot: "Dynadot",
    porkbun: "Porkbun",
    "cf-registrar": "Cloudflare",
    "cloudflare-zone": "Cloudflare",
    namecheap: "Namecheap",
    aliyun: "阿里云",
    tencent: "腾讯云",
    west: "西部数码",
    unknown: "未知",
  };
  return labels[registrar] ?? registrar;
}

function statusMeta(status: AssetStatus) {
  if (status === "normal") return { label: "正常", className: "bg-success/18 text-success" };
  if (status === "expiring") return { label: "即将到期", className: "bg-warning/18 text-warning" };
  if (status === "expired")
    return { label: "已过期", className: "bg-destructive/18 text-destructive" };
  if (status === "error") return { label: "异常", className: "bg-destructive/18 text-destructive" };
  return { label: "未知", className: "bg-muted text-muted-foreground" };
}

function statusLabel(status: AssetStatus) {
  return statusMeta(status).label;
}

function statusFromDays(days?: number): AssetStatus {
  if (typeof days !== "number") return "unknown";
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "normal";
}

function calculateDaysRemaining(expiresAt?: string) {
  if (!expiresAt) return undefined;
  return Math.ceil((Date.parse(expiresAt) - Date.now()) / 86400000);
}

function daysClass(days?: number) {
  if (typeof days !== "number") return "text-muted-foreground";
  if (days < 0) return "text-destructive";
  if (days <= 30) return "text-warning";
  return "text-success";
}

function formatDays(days?: number) {
  if (typeof days !== "number") return "未知";
  return `${days} 天`;
}

function formatDate(value?: string) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value?: string) {
  if (!value) return "未知 / 未获取";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知 / 未获取";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function newestDate(values: Array<string | undefined>) {
  const dates = values
    .filter(Boolean)
    .map((value) => new Date(value!).getTime())
    .filter(Number.isFinite);
  if (!dates.length) return undefined;
  return new Date(Math.max(...dates)).toISOString();
}

function formatCurrency(value: number) {
  return `¥ ${Math.round(value).toLocaleString("zh-CN")}`;
}

function booleanText(value?: boolean) {
  if (value === true) return "已开启";
  if (value === false) return "已关闭";
  return "未知 / 未获取";
}

function syncStatusText(status: DomainAsset["syncStatus"]) {
  if (status === "ok") return "正常";
  if (status === "missing") return "本次同步缺失";
  return "警告";
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}
