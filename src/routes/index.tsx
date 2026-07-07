import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeckMark } from "@/components/deck-mark";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { listPublicDomainAssets } from "@/lib/public.functions";
import { formatDate } from "@/lib/date-format";
import { LockKeyhole, Search, Sun, Moon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DS Hunter · 域名资产台账" },
      {
        name: "description",
        content: "公开查看 DS Hunter 已整理的域名资产、注册商覆盖与 Cloudflare 接入状态。",
      },
      { property: "og:title", content: "DS Hunter · 域名资产台账" },
      {
        property: "og:description",
        content: "看得见的域名资产台账，覆盖注册商、同步状态与 DNS 接入风险。",
      },
    ],
  }),
  component: PublicHome,
});

type PublicDomain = {
  domain: string;
  registrar: string;
  nsStatus: "cloudflare" | "other" | "unknown";
  syncStatus: "ok" | "missing" | "warning";
  lastSyncedAt: string;
  nsProvider?: string;
  registeredAt?: string;
  expiresAt?: string;
  source?: "registrar" | "manual";
};

function PublicHome() {
  const listFn = useServerFn(listPublicDomainAssets);
  const q = useQuery({ queryKey: ["public-domain-assets"], queryFn: () => listFn() });
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const rows = (q.data?.rows ?? []) as PublicDomain[];
  const loading = q.isLoading;
  const registrars = new Set(rows.map((row) => row.registrar));
  const cfCount = rows.filter((row) => row.nsStatus === "cloudflare").length;
  const visible = rows.filter((row) => !debounced || row.domain.includes(debounced));

  const stats: Readout[] = [
    { label: "域名总数", value: rows.length, unit: "个", dot: "signal-primary", text: "text-primary" },
    { label: "覆盖注册商", value: registrars.size, unit: "家", dot: "signal-muted", text: "text-foreground" },
    { label: "已接入 CF", value: cfCount, unit: "个", dot: "signal-success", text: "text-success" },
    { label: "待接入", value: rows.length - cfCount, unit: "个", dot: "signal-warning", text: "text-warning" },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-blueprint-fade opacity-70" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[46rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between py-4">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/25">
                <DeckMark className="size-5" />
              </span>
              <span>
                <span className="block font-display text-[15px] font-bold leading-none tracking-tight">
                  DS Hunter
                </span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Command Deck
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-1.5">
              <ThemeSwitch />
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/unlock">
                  <LockKeyhole className="size-4" />
                  登录后台
                </Link>
              </Button>
            </div>
          </header>

          <div className="py-14 md:py-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground backdrop-blur">
              <span className="signal signal-success signal-pulse" />
              Domain Asset Registry
            </div>
            <h1 className="mt-5 max-w-2xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
              看得见的域名资产
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              把分散在 Cloudflare、Spaceship、Dynadot、Porkbun 等平台的域名，收束成一张可检索、可核对的资产台账。
            </p>

            <div className="mt-10 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="bg-card p-4">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("signal", s.dot)} />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className={cn("font-display text-3xl font-bold tabular", s.text)}>
                      {loading ? "—" : s.value}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{s.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 资产表 ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
            <label className="relative block w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索域名…"
                className="pl-9 font-mono"
              />
            </label>
            <div className="font-mono text-xs tabular-nums text-muted-foreground">
              {visible.length} / {rows.length} 域名
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <Th>域名</Th>
                  <Th className="hidden sm:table-cell">注册商</Th>
                  <Th>DNS 状态</Th>
                  <Th className="hidden lg:table-cell">注册日期</Th>
                  <Th>到期日期</Th>
                  <Th className="hidden xl:table-cell">最近同步</Th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-sm text-muted-foreground">
                      {loading ? "正在载入域名资产…" : "暂无匹配的域名资产"}
                    </td>
                  </tr>
                )}
                {visible.map((row) => {
                  const s = statusMeta(row);
                  return (
                    <tr
                      key={`${row.registrar}-${row.domain}`}
                      className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{row.domain}</span>
                          {row.source === "manual" && (
                            <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              手动
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <RegistrarChip registrar={row.registrar} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("signal", s.dot)} />
                          <span className="whitespace-nowrap text-sm">{s.label}</span>
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                        {row.registeredAt ? formatDate(row.registeredAt) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {row.expiresAt ? (
                          <span className={cn("font-mono text-xs", expiryClass(row.expiresAt))}>
                            {formatDate(row.expiresAt)}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground xl:table-cell">
                        {formatDate(row.lastSyncedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------- 页脚 ---------- */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DeckMark className="size-4" />
            <span className="font-mono text-xs">dshunter · command deck</span>
          </div>
          <span className="text-xs text-muted-foreground">单用户域名资产与 DNS 运维控制台</span>
        </div>
      </footer>
    </main>
  );
}

type Readout = {
  label: string;
  value: number;
  unit: string;
  dot: string;
  text: string;
};

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function ThemeSwitch() {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "切换到浅色" : "切换到深色"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function RegistrarChip({ registrar }: { registrar: string }) {
  const label = registrarLabel(registrar);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted font-mono text-[11px] font-semibold text-muted-foreground">
        {label.slice(0, 1)}
      </span>
      <span className="text-sm">{label}</span>
    </span>
  );
}

function statusMeta(row: PublicDomain): { dot: string; label: string } {
  if (row.syncStatus === "missing") return { dot: "signal-danger", label: "同步缺失" };
  if (row.nsStatus === "cloudflare") return { dot: "signal-success", label: "已接入 Cloudflare" };
  if (row.nsStatus === "other") return { dot: "signal-warning", label: "非 Cloudflare 解析" };
  return { dot: "signal-muted", label: "待检测" };
}

// 到期日期着色：已过期红色、30 天内琥珀、其余中性。
function expiryClass(expiresAt: string): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return "text-muted-foreground";
  if (days < 0) return "font-medium text-destructive";
  if (days <= 30) return "text-warning";
  return "text-muted-foreground";
}

function registrarLabel(registrar: string) {
  const map: Record<string, string> = {
    spaceship: "Spaceship",
    dynadot: "Dynadot",
    porkbun: "Porkbun",
    namecheap: "Namecheap",
    aliyun: "阿里云",
    tencent: "腾讯云",
    west: "西部数码",
    "cf-registrar": "Cloudflare",
    manual: "手动录入",
  };
  return map[registrar] ?? registrar;
}
