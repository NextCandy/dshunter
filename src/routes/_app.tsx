import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { checkGate, lockSite } from "@/lib/gate.functions";
import { getSiteSettings } from "@/lib/site-settings.functions";
import { useDomains } from "@/lib/domain-store";
import { useTheme } from "@/components/theme-provider";
import { DeckMark } from "@/components/deck-mark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Bell,
  Globe,
  Link2,
  ListTree,
  Settings,
  LogOut,
  LayoutDashboard,
  DatabaseBackup,
  Menu,
  Sun,
  Moon,
  Download,
  PenLine,
} from "lucide-react";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const r = await checkGate();
    if (!r.unlocked) throw redirect({ to: "/unlock" });
  },
  component: AppLayout,
});

const HEADINGS: { to: string; title: string; sub: string }[] = [
  { to: "/dashboard", title: "指挥台", sub: "运营概览" },
  { to: "/domains", title: "域名列表", sub: "拉取 · 合并 · 筛选" },
  { to: "/bind", title: "批量绑定", sub: "接入 Cloudflare" },
  { to: "/records", title: "解析记录", sub: "DNS 记录管理" },
  { to: "/backup", title: "备份与恢复", sub: "导出 · 差异 · 恢复" },
  { to: "/site-settings", title: "站点设置", sub: "前台展示与联系信息" },
  { to: "/settings", title: "设置", sub: "凭证与偏好" },
];

function AppLayout() {
  const router = useRouter();
  const lock = useServerFn(lockSite);
  const getSettings = useServerFn(getSiteSettings);
  const settingsQuery = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => getSettings(),
    staleTime: 60_000,
  });
  const siteName = settingsQuery.data?.settings.siteName || "DS Hunter";
  const logoUrl = settingsQuery.data?.settings.logoUrl || "";
  const domains = useDomains();
  const notifications = buildNotifications(domains);
  const onLock = async () => {
    await lock();
    router.navigate({ to: "/unlock" });
  };
  const nav = <SidebarNav onLock={onLock} siteName={siteName} logoUrl={logoUrl} />;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {nav}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/80 px-3 backdrop-blur-md md:px-5">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="打开导航">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
              {nav}
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="flex items-center gap-2 md:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/25">
              <AdminBrandIcon logoUrl={logoUrl} className="size-4" />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">{siteName}</span>
          </Link>

          <div className="hidden md:block">
            <PageHeading />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button asChild size="sm" className="hidden h-8 gap-1.5 font-medium sm:inline-flex">
              <Link to="/domains">
                <Download className="size-3.5" />
                拉取域名
              </Link>
            </Button>
            <ThemeSwitch />
            <NotificationsBell notifications={notifications} />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 xl:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function PageHeading() {
  const { pathname } = useLocation();
  const meta = HEADINGS.find((h) => pathname.startsWith(h.to)) ?? HEADINGS[0];
  return (
    <div className="min-w-0">
      <div className="truncate font-display text-sm font-semibold tracking-tight text-foreground">
        {meta.title}
      </div>
      <div className="truncate text-[11px] text-muted-foreground">{meta.sub}</div>
    </div>
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

function NotificationsBell({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="通知">
          <Bell className="size-4" />
          {notifications.length > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center rounded-full px-1 font-mono text-[10px] tabular-nums">
              {notifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 overflow-hidden rounded-xl border-border/70 bg-popover/95 p-0 backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">通知</div>
            <div className="text-xs text-muted-foreground">待续费与解析风险</div>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {notifications.length}
          </span>
        </div>
        <div className="max-h-80 overflow-auto p-1.5">
          {notifications.slice(0, 6).map((item) => (
            <div key={item.title} className="flex gap-2.5 rounded-lg p-2.5 hover:bg-muted/50">
              <span className="signal signal-warning mt-1.5 shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{item.description}</div>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              一切正常，暂无待办
            </div>
          )}
        </div>
        <Link
          to="/domains"
          className="block border-t border-border/60 px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-primary/5"
        >
          查看全部域名
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function SidebarNav({
  onLock,
  siteName,
  logoUrl,
}: {
  onLock: () => void | Promise<void>;
  siteName: string;
  logoUrl: string;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-0.5 p-3">
      <Link to="/dashboard" className="mb-4 flex items-center gap-2.5 px-1.5 pt-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/25">
          <AdminBrandIcon logoUrl={logoUrl} className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-[15px] font-bold leading-none tracking-tight text-sidebar-foreground">
            {siteName}
          </span>
          <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Command Deck
          </span>
        </span>
      </Link>

      <NavGroup label="域名" />
      <NavItem to="/dashboard" exact icon={<LayoutDashboard className="size-4" />}>
        指挥台
      </NavItem>
      <NavItem to="/domains" icon={<Globe className="size-4" />}>
        域名列表
      </NavItem>
      <NavItem to="/manual" icon={<PenLine className="size-4" />}>
        手动域名
      </NavItem>
      <NavItem to="/bind" icon={<Link2 className="size-4" />}>
        批量绑定
      </NavItem>
      <NavItem to="/records" icon={<ListTree className="size-4" />} badge="风险">
        解析记录
      </NavItem>

      <NavGroup label="系统" />
      <NavItem to="/backup" icon={<DatabaseBackup className="size-4" />}>
        备份与恢复
      </NavItem>
      <NavItem to="/site-settings" icon={<Settings className="size-4" />}>
        站点设置
      </NavItem>
      <NavItem to="/settings" icon={<Settings className="size-4" />}>
        设置
      </NavItem>

      <div className="mt-auto pt-2">
        <div className="mb-2 border-t border-sidebar-border" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={onLock}
        >
          <LogOut className="size-4" /> 退出登录
        </Button>
      </div>
    </div>
  );
}

function AdminBrandIcon({ logoUrl, className }: { logoUrl: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logoUrl]);
  if (!logoUrl || failed) return <DeckMark className={className} />;
  return <img src={logoUrl} alt="" className={className} onError={() => setFailed(true)} />;
}

function NavGroup({ label }: { label: string }) {
  return (
    <div className="px-3 pb-1 pt-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
      {label}
    </div>
  );
}

function NavItem({
  to,
  icon,
  badge,
  exact = false,
  children,
}: {
  to: string;
  icon: ReactNode;
  badge?: string;
  exact?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      activeProps={{
        className:
          "relative flex items-center gap-2.5 rounded-lg bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-accent-foreground before:absolute before:-left-1 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary before:shadow-[0_0_8px_var(--color-primary)]",
      }}
    >
      <span className="grid size-4 shrink-0 place-items-center opacity-90">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          <span className="size-1.5 rounded-full bg-destructive" />
          {badge}
        </span>
      )}
    </Link>
  );
}

type NotificationItem = { title: string; description: string };

function buildNotifications(domains: string[]): NotificationItem[] {
  if (domains.length === 0) return [];
  return domains.slice(0, 5).map((domain) => ({
    title: `解析待确认：${domain}`,
    description: "尚未完成 DNS 检测，进入解析记录页确认 Zone 状态。",
  }));
}
