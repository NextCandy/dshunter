import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Eye,
  FileClock,
  Filter,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, PageHeader, StatCard } from "@/components/app-shell";
import {
  listRegistrarDomainsFn,
  listRegistrarSyncJobsFn,
  listSyncableRegistrarsFn,
  registrarDomainStatsFn,
  syncRegistrarDomainsFn,
  updateRegistrarDomainFn,
} from "@/lib/registrar-domains.functions";

export const Route = createFileRoute("/registrar-domains")({
  component: RegistrarDomainsPage,
});

type DomainRow = {
  id: number;
  registrar: string;
  registrar_account_name: string | null;
  domain_name: string;
  expiry_date: string | null;
  estimated_value: string | number | null;
  auto_renew: boolean | null;
  nameservers: string[] | null;
  domain_status: string;
  sync_status: string;
  sync_error: string | null;
  note: string | null;
  raw_data: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  last_synced_at: string;
  removed_from_registrar_at: string | null;
  updated_at: string;
};

type SyncJob = {
  id: number;
  registrar: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_count: number;
  created_count: number;
  updated_count: number;
  missing_count: number;
  failed_count: number;
  error_message: string | null;
};

type RegistrarOption = {
  id: number;
  name: string;
  slug: string | null;
  enabled: boolean;
  api_enabled: boolean;
  has_api_key: boolean;
  has_api_secret: boolean;
  last_domain_sync_at: string | null;
};

type SyncMutationResult = {
  status: "success" | "failed";
  createdCount: number;
  updatedCount: number;
  missingCount: number;
  failedCount: number;
  errorMessage?: string;
};

type StatusFilter =
  "all" | "active" | "expiring_soon" | "expired" | "sync_error" | "removed_from_registrar";
type SortBy = "expiry_date" | "estimated_value" | "domain_name" | "last_synced_at";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "active", label: "活跃中" },
  { value: "expiring_soon", label: "30 天内到期" },
  { value: "expired", label: "已过期" },
  { value: "sync_error", label: "同步异常" },
  { value: "removed_from_registrar", label: "已从注册商移除" },
];

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "expiry_date", label: "到期时间" },
  { value: "estimated_value", label: "预估价值" },
  { value: "domain_name", label: "域名 A-Z" },
  { value: "last_synced_at", label: "最近同步时间" },
];

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function RegistrarDomainsPage() {
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [registrar, setRegistrar] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("expiry_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DomainRow | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const filters = useMemo(
    () => ({ search, registrar, status, sortBy, sortOrder, page, pageSize: 50 }),
    [search, registrar, status, sortBy, sortOrder, page],
  );

  const stats = useQuery({
    queryKey: ["registrar-domain-stats"],
    queryFn: () => registrarDomainStatsFn(),
  });
  const registrars = useQuery({
    queryKey: ["syncable-registrars"],
    queryFn: () => listSyncableRegistrarsFn() as Promise<RegistrarOption[]>,
  });
  const domains = useQuery({
    queryKey: ["registrar-domains", filters],
    queryFn: () =>
      listRegistrarDomainsFn({ data: filters }) as Promise<{
        rows: DomainRow[];
        total: number;
        page: number;
        pageSize: number;
      }>,
  });
  const jobs = useQuery({
    queryKey: ["registrar-sync-jobs"],
    queryFn: () => listRegistrarSyncJobsFn() as Promise<SyncJob[]>,
  });

  const syncMutation = useMutation({
    mutationFn: (registrarId: number) =>
      syncRegistrarDomainsFn({ data: { registrarId } }) as Promise<SyncMutationResult>,
    onSuccess: (result) => {
      if (result.status === "failed") {
        toast.error(result.errorMessage || "同步失败");
      } else {
        toast.success(
          `同步完成：新增 ${result.createdCount}，更新 ${result.updatedCount}，移除标记 ${result.missingCount}`,
        );
      }
      qc.invalidateQueries({ queryKey: ["registrar-domain-stats"] });
      qc.invalidateQueries({ queryKey: ["registrar-domains"] });
      qc.invalidateQueries({ queryKey: ["registrar-sync-jobs"] });
      qc.invalidateQueries({ queryKey: ["syncable-registrars"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "同步失败")),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; note: string }) =>
      updateRegistrarDomainFn({
        data: { id: payload.id, patch: { note: payload.note || null } },
      }) as Promise<DomainRow>,
    onSuccess: (row) => {
      toast.success("备注已保存");
      setSelected(row);
      qc.invalidateQueries({ queryKey: ["registrar-domains"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "保存失败")),
  });

  useEffect(() => {
    setPage(1);
  }, [search, registrar, status, sortBy, sortOrder]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setNoteDraft(selected?.note ?? "");
  }, [selected]);

  const rows = domains.data?.rows ?? [];
  const total = domains.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));
  const syncableRegistrars = registrars.data ?? [];
  const primaryRegistrar =
    syncableRegistrars.find((item) => item.has_api_key && item.has_api_secret) ??
    syncableRegistrars[0];

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["registrar-domain-stats"] });
    qc.invalidateQueries({ queryKey: ["registrar-domains"] });
    qc.invalidateQueries({ queryKey: ["registrar-sync-jobs"] });
    toast.success("列表已刷新");
  }

  function exportCsv() {
    if (!rows.length) {
      toast.error("当前没有可导出的域名");
      return;
    }
    const header = [
      "域名",
      "注册商",
      "状态",
      "同步状态",
      "到期时间",
      "预估价值",
      "自动续费",
      "Nameserver",
      "首次发现",
      "最近同步",
      "备注",
    ];
    const body = rows.map((row) => [
      row.domain_name,
      row.registrar,
      statusLabel(row),
      syncLabel(row.sync_status),
      formatDate(row.expiry_date),
      valueNumber(row.estimated_value) || "",
      row.auto_renew == null ? "" : row.auto_renew ? "是" : "否",
      (row.nameservers ?? []).join(" "),
      formatDateTime(row.first_seen_at),
      formatDateTime(row.last_synced_at),
      row.note ?? "",
    ]);
    const csv = "\uFEFF" + [header, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrar-domains-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <PageHeader
        title="注册商域名资产"
        description="从注册商 API 同步后的持久化资产列表，刷新、重新登录和容器重启后仍从数据库读取。"
        actions={
          <>
            <button type="button" className="btn-base btn-ghost" onClick={refreshAll}>
              <RefreshCw className="h-4 w-4" />
              手动刷新
            </button>
            <button type="button" className="btn-base btn-ghost" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              导出 CSV
            </button>
            <button
              type="button"
              className="btn-base btn-primary"
              disabled={
                !primaryRegistrar ||
                !primaryRegistrar.has_api_key ||
                !primaryRegistrar.has_api_secret ||
                syncMutation.isPending
              }
              onClick={() => primaryRegistrar && syncMutation.mutate(primaryRegistrar.id)}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              同步注册商域名
            </button>
          </>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard icon={Globe2} label="域名总数" value={stats.data?.totalDomains ?? 0} />
        <StatCard
          icon={Clock3}
          label="30 天内到期"
          value={stats.data?.expiringSoon ?? 0}
          tone="warning"
        />
        <StatCard
          icon={AlertTriangle}
          label="已过期"
          value={stats.data?.expired ?? 0}
          tone="danger"
        />
        <StatCard
          icon={Database}
          label="总预估价值"
          value={formatCurrency(stats.data?.totalValue ?? 0)}
          tone="success"
        />
        <StatCard icon={Server} label="已同步注册商" value={stats.data?.syncedRegistrars ?? 0} />
        <StatCard
          icon={ShieldCheck}
          label="同步失败数"
          value={stats.data?.syncFailures ?? 0}
          tone={(stats.data?.syncFailures ?? 0) ? "danger" : "success"}
        />
        <StatCard icon={FileClock} label="最近同步" value={shortTime(stats.data?.lastSyncedAt)} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card-elev p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">注册商连接状态</h2>
            </div>
            <Link
              to="/admin/registrars"
              className="text-xs font-medium text-primary hover:underline"
            >
              配置凭证
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {syncableRegistrars.map((item) => {
              const configured = item.has_api_key && item.has_api_secret;
              return (
                <div key={item.id} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {configured ? "凭证已加密保存" : "缺少 API Key 或 Secret"}
                      </div>
                    </div>
                    {configured ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {shortTime(item.last_domain_sync_at)}
                    </span>
                    <button
                      type="button"
                      className="btn-base btn-ghost h-8 px-2.5 text-xs"
                      disabled={!configured || syncMutation.isPending}
                      onClick={() => syncMutation.mutate(item.id)}
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      同步
                    </button>
                  </div>
                </div>
              );
            })}
            {!syncableRegistrars.length && (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                还没有启用的注册商。请先在后台保存注册商 API 凭证。
              </div>
            )}
          </div>
        </div>

        <div className="card-elev p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileClock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">最近同步记录</h2>
          </div>
          <div className="space-y-2">
            {(jobs.data ?? []).slice(0, 5).map((job) => (
              <div key={job.id} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{job.registrar}</span>
                  <JobBadge status={job.status} />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs text-muted-foreground">
                  <MiniCount label="总数" value={job.total_count} />
                  <MiniCount label="新增" value={job.created_count} />
                  <MiniCount label="更新" value={job.updated_count} />
                  <MiniCount label="移除" value={job.missing_count} />
                </div>
                {job.error_message && (
                  <div className="mt-2 text-xs text-destructive">{job.error_message}</div>
                )}
              </div>
            ))}
            {!jobs.data?.length && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                暂无同步记录
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card-elev overflow-hidden">
        <div className="border-b border-border bg-surface-2 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_190px_190px_120px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="field pl-9"
                placeholder="搜索域名、注册商、备注（Ctrl+/）"
              />
            </label>
            <select
              value={registrar}
              onChange={(event) => setRegistrar(event.target.value)}
              className="field"
            >
              <option value="all">全部注册商</option>
              {syncableRegistrars.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="field"
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortBy)}
              className="field"
            >
              {SORT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="btn-base btn-ghost"
            >
              <Filter className="h-4 w-4" />
              {sortOrder === "asc" ? "升序" : "降序"}
            </button>
          </div>
        </div>

        {domains.isLoading ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="p-5">
            <EmptyState
              title="还没有持久化的注册商域名"
              hint="配置注册商 API 后点击“同步注册商域名”，同步结果会写入数据库。"
              action={
                <button
                  type="button"
                  className="btn-base btn-primary"
                  disabled={
                    !primaryRegistrar ||
                    !primaryRegistrar.has_api_key ||
                    !primaryRegistrar.has_api_secret ||
                    syncMutation.isPending
                  }
                  onClick={() => primaryRegistrar && syncMutation.mutate(primaryRegistrar.id)}
                >
                  立即同步注册商域名
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-border bg-surface text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">域名</th>
                    <th className="px-3 py-3 text-left font-medium">注册商</th>
                    <th className="px-3 py-3 text-left font-medium">状态</th>
                    <th className="px-3 py-3 text-left font-medium">到期时间</th>
                    <th className="px-3 py-3 text-right font-medium">预估价值</th>
                    <th className="px-3 py-3 text-left font-medium">最近同步</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0 hover:bg-accent/35"
                    >
                      <td className="px-4 py-3">
                        <div
                          className="max-w-[300px] truncate font-mono font-semibold"
                          title={row.domain_name}
                        >
                          {row.domain_name}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {(row.nameservers ?? []).slice(0, 2).join(" / ") || "暂无 nameserver"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {row.registrar}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <DomainStatus row={row} />
                          <SyncStatus status={row.sync_status} error={row.sync_error} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <ExpiryCell value={row.expiry_date} />
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {formatCurrency(valueNumber(row.estimated_value))}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {formatDateTime(row.last_synced_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="btn-base btn-ghost h-8 px-2.5 text-xs"
                          onClick={() => setSelected(row)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-3 lg:hidden">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelected(row)}
                  className="rounded-lg border border-border bg-surface-2 p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-all font-mono text-sm font-semibold">
                        {row.domain_name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.registrar}</div>
                    </div>
                    <DomainStatus row={row} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>到期：{formatDate(row.expiry_date)}</span>
                    <span>价值：{formatCurrency(valueNumber(row.estimated_value))}</span>
                    <span>同步：{shortTime(row.last_synced_at)}</span>
                    <span>
                      续费：{row.auto_renew == null ? "未知" : row.auto_renew ? "自动" : "手动"}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                共 {total} 条，当前第 {page} / {totalPages} 页
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-base btn-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  上一页
                </button>
                <button
                  type="button"
                  className="btn-base btn-ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="h-full w-full overflow-auto border-l border-border bg-background shadow-2xl sm:max-w-2xl sm:rounded-l-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 p-4 backdrop-blur">
              <div className="min-w-0">
                <div className="break-all font-mono text-lg font-semibold">
                  {selected.domain_name}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selected.registrar} · 首次发现 {formatDateTime(selected.first_seen_at)}
                </div>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-md border border-border hover:bg-accent"
                onClick={() => setSelected(null)}
                aria-label="关闭详情"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-5 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="到期时间" value={formatDate(selected.expiry_date)} />
                <DetailItem
                  label="自动续费"
                  value={
                    selected.auto_renew == null ? "未知" : selected.auto_renew ? "已开启" : "未开启"
                  }
                />
                <DetailItem
                  label="预估价值"
                  value={formatCurrency(valueNumber(selected.estimated_value))}
                />
                <DetailItem label="最近同步" value={formatDateTime(selected.last_synced_at)} />
                <DetailItem label="状态" value={statusLabel(selected)} />
                <DetailItem label="同步状态" value={syncLabel(selected.sync_status)} />
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Nameserver</h3>
                <div className="rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs text-muted-foreground">
                  {(selected.nameservers ?? []).length
                    ? selected.nameservers?.map((ns) => <div key={ns}>{ns}</div>)
                    : "暂无 nameserver 数据"}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">备注</h3>
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  className="field min-h-24"
                  placeholder="添加内部备注，不会覆盖注册商原始数据"
                />
                <button
                  type="button"
                  className="btn-base btn-primary mt-2"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ id: selected.id, note: noteDraft })}
                >
                  保存备注
                </button>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">原始数据摘要</h3>
                <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
                  {JSON.stringify(selected.raw_data ?? {}, null, 2)}
                </pre>
              </section>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DomainStatus({ row }: { row: DomainRow }) {
  const label = statusLabel(row);
  const cls =
    row.domain_status === "removed_from_registrar" || row.sync_status === "missing"
      ? "bg-warning/15 text-warning"
      : row.expiry_date && new Date(row.expiry_date).getTime() < Date.now()
        ? "bg-destructive/10 text-destructive"
        : "bg-success/15 text-success";
  return (
    <span className={`inline-flex w-fit rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function SyncStatus({ status, error }: { status: string; error?: string | null }) {
  const cls =
    status === "ok" ? "text-success" : status === "missing" ? "text-warning" : "text-destructive";
  return (
    <span className={`text-xs ${cls}`} title={error ?? undefined}>
      {syncLabel(status)}
    </span>
  );
}

function ExpiryCell({ value }: { value: string | null }) {
  const days = daysUntil(value);
  const cls =
    days == null
      ? "text-muted-foreground"
      : days < 0
        ? "text-destructive"
        : days <= 30
          ? "text-warning"
          : "text-foreground";
  return (
    <div>
      <div className={`font-mono text-sm tabular-nums ${cls}`}>{formatDate(value)}</div>
      {days != null && (
        <div className="mt-1 text-xs text-muted-foreground">
          {days < 0 ? `已过期 ${Math.abs(days)} 天` : `${days} 天后到期`}
        </div>
      )}
    </div>
  );
}

function JobBadge({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "bg-success/15 text-success"
      : status === "running"
        ? "bg-primary/10 text-primary"
        : "bg-destructive/10 text-destructive";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status === "success" ? "成功" : status === "running" ? "运行中" : "失败"}
    </span>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono text-sm font-semibold text-foreground">{value}</div>
      <div>{label}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function statusLabel(row: DomainRow) {
  if (row.domain_status === "removed_from_registrar" || row.sync_status === "missing")
    return "已从注册商移除";
  if (row.expiry_date && new Date(row.expiry_date).getTime() < Date.now()) return "已过期";
  return "活跃中";
}

function syncLabel(status: string) {
  if (status === "ok") return "同步正常";
  if (status === "warning") return "字段异常";
  if (status === "missing") return "注册商侧缺失";
  if (status === "error") return "同步错误";
  return status || "未知";
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / 86_400_000);
}

function formatDate(value: string | null) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return "从未";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function shortTime(value?: string | null) {
  if (!value) return "从未";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function valueNumber(value: string | number | null | undefined) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function csvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
