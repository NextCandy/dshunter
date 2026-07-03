import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listPublicDomainAssets } from "@/lib/public.functions";
import { formatDate } from "@/lib/date-format";
import { Globe2, LockKeyhole, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DS Hunter · 域名资产清单" },
      {
        name: "description",
        content: "公开查看 DS Hunter 已整理的域名资产、注册商覆盖与 Cloudflare 接入状态。",
      },
      { property: "og:title", content: "DS Hunter · 域名资产清单" },
      {
        property: "og:description",
        content: "看得见的域名资产清单，覆盖注册商、同步状态与 DNS 接入风险。",
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
  const registrars = new Set(rows.map((row) => row.registrar));
  const visible = rows.filter((row) => !debounced || row.domain.includes(debounced));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border/60 bg-card/40">
        <div className="mx-auto flex min-h-[56vh] max-w-7xl flex-col justify-between px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/50">
                <Globe2 className="size-4 text-primary" />
              </div>
              <span className="font-semibold">DS Hunter</span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/unlock">
                <LockKeyhole className="mr-2 size-4" />
                登录后台
              </Link>
            </Button>
          </header>

          <div className="max-w-3xl py-16">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              看得见的域名资产
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              把分散在 Cloudflare / Spaceship / Dynadot / Porkbun 等平台的域名收束成一张可检索、可核对的资产清单。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-sm">
                总域名数 {rows.length}
              </span>
              <span className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-sm">
                覆盖注册商 {registrars.size}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-border/60 bg-card/60 backdrop-blur">
          <div className="border-b border-border/60 p-4">
            <label className="relative block max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索域名"
                className="pl-9"
              />
            </label>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/95">
                <tr>
                  <th className="p-3 text-left font-medium text-muted-foreground">域名</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">注册商</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">DNS 状态</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">最近同步</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-muted-foreground">
                      {q.isLoading ? "正在载入域名资产…" : "暂无匹配的域名资产"}
                    </td>
                  </tr>
                )}
                {visible.map((row) => (
                  <tr key={`${row.registrar}-${row.domain}`} className="border-t border-border/60 hover:bg-muted/40">
                    <td className="p-3 font-mono font-medium">{row.domain}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-xs">
                            {registrarLabel(row.registrar).slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        {registrarLabel(row.registrar)}
                      </div>
                    </td>
                    <td className="p-3">{statusBadge(row)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(row.lastSyncedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </main>
  );
}

function statusBadge(row: PublicDomain) {
  if (row.syncStatus === "missing") return <Badge variant="destructive">同步缺失</Badge>;
  if (row.nsStatus === "cloudflare") return <Badge>已接入 Cloudflare</Badge>;
  if (row.nsStatus === "other") return <Badge variant="outline">非 Cloudflare NS</Badge>;
  return <Badge variant="secondary">待检测</Badge>;
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
  };
  return map[registrar] ?? registrar;
}
