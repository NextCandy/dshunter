import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { checkGate, lockSite } from "@/lib/gate.functions";
import { useDomains } from "@/lib/domain-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Bell,
  Globe,
  HelpCircle,
  Link2,
  ListTree,
  Settings,
  LogOut,
  LayoutDashboard,
  DatabaseBackup,
  Menu,
  Search,
  UserCircle,
} from "lucide-react";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const r = await checkGate();
    if (!r.unlocked) throw redirect({ to: "/unlock" });
  },
  component: AppLayout,
});

function AppLayout() {
  const router = useRouter();
  const lock = useServerFn(lockSite);
  const domains = useDomains();
  const notifications = buildNotifications(domains);
  const nav = <SidebarNav onLock={async () => {
    await lock();
    router.navigate({ to: "/unlock" });
  }} />;
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-card/40 p-3 backdrop-blur md:flex">
        {nav}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/90 px-3 backdrop-blur md:px-5">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="打开导航">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-border/60 bg-background p-3">
              {nav}
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <Globe className="size-4 text-primary" />
            <span className="truncate text-sm font-semibold">DS Hunter</span>
          </div>
          <div className="hidden flex-1 justify-center md:flex">
            <TopTabs />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="hidden h-8 gap-2 text-muted-foreground lg:inline-flex">
              <Search className="size-3.5" />
              搜索
              <kbd className="rounded border border-border/80 px-1 text-[10px] text-muted-foreground">⌘K</kbd>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="通知">
                  <Bell className="size-4" />
                  {notifications.length > 0 && (
                    <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-[10px]">
                      {notifications.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 border-border/60 bg-popover/95 p-0 backdrop-blur">
                <div className="border-b border-border/60 px-4 py-3">
                  <div className="text-sm font-semibold">通知</div>
                  <div className="text-xs text-muted-foreground">待续费与解析风险</div>
                </div>
                <div className="max-h-80 overflow-auto p-2">
                  {notifications.slice(0, 5).map((item) => (
                    <div key={item.title} className="rounded-lg p-2 text-sm hover:bg-muted/40">
                      <div className="font-medium">{item.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{item.description}</div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">暂无通知</div>
                  )}
                </div>
                <Link to="/domains" className="block border-t border-border/60 px-4 py-2 text-sm text-primary">
                  查看全部
                </Link>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" aria-label="帮助">
              <HelpCircle className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="账户菜单">
              <UserCircle className="size-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 xl:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ onLock }: { onLock: () => void | Promise<void> }) {
  return (
    <div className="flex h-full w-full flex-col gap-1">
      <div className="mb-3 flex items-center gap-2.5 px-2 py-3">
        <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-muted/50">
          <Globe className="size-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-bold leading-tight tracking-tight">DS Hunter</div>
          <div className="text-[11px] text-muted-foreground">域名运营工作台</div>
        </div>
      </div>
      <NavGroup label="域名" />
      <NavItem to="/dashboard" icon={<LayoutDashboard className="size-4" />}>仪表盘</NavItem>
      <NavItem to="/domains" icon={<Globe className="size-4" />}>域名列表</NavItem>
      <NavItem to="/bind" icon={<Link2 className="size-4" />}>批量绑定</NavItem>
      <NavItem to="/records" icon={<ListTree className="size-4" />} badge="风险">解析记录</NavItem>
      <NavGroup label="系统" className="pt-3" />
      <NavItem to="/backup" icon={<DatabaseBackup className="size-4" />}>备份与恢复</NavItem>
      <NavItem to="/settings" icon={<Settings className="size-4" />}>设置</NavItem>
      <div className="mt-auto border-t border-border/60 pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={onLock}
        >
          <LogOut className="mr-2 size-4" /> 退出
        </Button>
      </div>
    </div>
  );
}

function NavGroup({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground ${className}`}>
      {label}
    </div>
  );
}

function TopTabs() {
  const location = useLocation();
  const items = [
    { to: "/dashboard", label: "仪表盘" },
    { to: "/domains", label: "域名" },
    { to: "/records", label: "解析" },
    { to: "/backup", label: "备份" },
    { to: "/settings", label: "设置" },
  ];
  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const active =
          item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className="relative rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className={active ? "text-foreground" : ""}>{item.label}</span>
            {active && (
              <motion.span
                layoutId="tab-indicator"
                className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-primary"
                transition={{ duration: 0.2 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function NavItem({
  to,
  icon,
  badge,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      activeOptions={{ exact: to === "/dashboard" }}
      activeProps={{
        className:
          "relative flex items-center gap-2.5 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary before:absolute before:left-0 before:top-2 before:h-5 before:w-0.5 before:rounded-full before:bg-primary",
      }}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge && (
        <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
          {badge}
        </span>
      )}
    </Link>
  );
}

function buildNotifications(domains: string[]) {
  if (domains.length === 0) return [];
  return domains.slice(0, 5).map((domain) => ({
    title: `解析异常：${domain}`,
    description: "尚未完成 DNS 检测，请进入解析记录页确认 Zone 状态。",
  }));
}
