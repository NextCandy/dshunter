import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { checkGate } from "@/lib/gate.functions";
import { listPublicDomains, type PublicDomain } from "@/lib/public-domains.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, ArrowUpDown, Globe, LogIn, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DS Hunter · 域名资产清单" },
      {
        name: "description",
        content: "DS Hunter 域名资产清单：域名、注册日期、到期日期、注册商一览。",
      },
    ],
  }),
  // 已登录用户直接进入详细控制台；未登录用户看公开清单。
  beforeLoad: async () => {
    const gate = await checkGate();
    if (gate.unlocked) throw redirect({ to: "/domains" });
  },
  loader: async () => ({ domains: await listPublicDomains() }),
  component: PublicDomainList,
});

const PAGE_SIZE = 100;
type SortKey = "domain" | "registeredAt" | "expiresAt";
type SortDir = "asc" | "desc";

function fmtDate(v?: string) {
  if (!v) return "—";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function expiryClass(d: PublicDomain) {
  const days = d.daysRemaining;
  if (d.status === "expired" || (typeof days === "number" && days < 0)) {
    return "text-red-600";
  }
  if (d.status === "expiring" || (typeof days === "number" && days <= 30)) {
    return "text-amber-600";
  }
  return "text-foreground";
}

function expiryHint(d: PublicDomain) {
  const days = d.daysRemaining;
  if (d.status === "expired" || (typeof days === "number" && days < 0)) return "已过期";
  if (typeof days === "number" && days <= 30) return `${days} 天后到期`;
  return null;
}

function PublicDomainList() {
  const { domains } = Route.useLoaderData();
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("expiresAt");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const rows = kw
      ? domains.filter(
          (d) =>
            d.domain.toLowerCase().includes(kw) ||
            d.registrarLabel.toLowerCase().includes(kw),
        )
      : domains;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "domain") return a.domain.localeCompare(b.domain) * dir;
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av === bv) return a.domain.localeCompare(b.domain);
      if (!av) return 1; // 空日期恒排在最后
      if (!bv) return -1;
      return av < bv ? -dir : dir;
    });
  }, [domains, q, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [q, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            ✦ DS Hunter
          </Link>
          <Button asChild size="sm" className="rounded-full px-4">
            <Link to="/unlock">
              <LogIn className="mr-1.5 size-4" />
              登录
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">域名资产清单</h1>
          <p className="text-sm text-muted-foreground">
            共 <span className="font-semibold text-foreground">{domains.length}</span> 个域名 ·
            登录后可管理注册商、DNS、到期监控等完整功能
          </p>
        </div>

        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索域名或注册商"
              className="pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center text-sm text-muted-foreground">
            <Globe className="mx-auto mb-3 size-8 opacity-40" />
            {domains.length === 0 ? "暂无域名数据" : "没有匹配的域名"}
          </div>
        ) : (
          <>
            {/* 桌面端表格 */}
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-12 px-4 py-3 font-medium">#</th>
                    <SortHeader label="域名" k="domain" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="注册日期" k="registeredAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="到期日期" k="expiresAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-3 font-medium">注册商</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((d, i) => (
                    <tr
                      key={`${d.registrar}:${d.domain}`}
                      className="border-b border-border last:border-0 transition hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {(curPage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium">{d.domain}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(d.registeredAt)}</td>
                      <td className={`px-4 py-3 ${expiryClass(d)}`}>
                        {fmtDate(d.expiresAt)}
                        {expiryHint(d) && (
                          <span className="ml-2 text-xs opacity-80">({expiryHint(d)})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs">
                          {d.registrarLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端卡片 */}
            <div className="space-y-2 md:hidden">
              {pageRows.map((d) => (
                <div
                  key={`${d.registrar}:${d.domain}`}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{d.domain}</span>
                    <span className="shrink-0 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs">
                      {d.registrarLabel}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">注册日期</div>
                      <div>{fmtDate(d.registeredAt)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">到期日期</div>
                      <div className={expiryClass(d)}>
                        {fmtDate(d.expiresAt)}
                        {expiryHint(d) && <span className="ml-1 opacity-80">({expiryHint(d)})</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 分页 */}
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                第 {curPage} / {totalPages} 页 · 显示 {pageRows.length} / {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={curPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={curPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-foreground"
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}
