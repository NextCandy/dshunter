import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { checkGate, lockSite } from "@/lib/gate.functions";
import { Button } from "@/components/ui/button";
import {
  Archive,
  BarChart3,
  Bell,
  ChevronDown,
  CircleHelp,
  DatabaseBackup,
  FileDown,
  FolderTree,
  Gauge,
  Globe,
  History,
  Import,
  LayoutDashboard,
  Link2,
  ListTree,
  LogOut,
  Menu,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Recycle,
  Search,
  Settings,
  ShieldAlert,
  Star,
  TimerReset,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const r = await checkGate();
    if (!r.unlocked) throw redirect({ to: "/unlock" });
  },
  component: AppLayout,
});

const TOP_NAV = [
  { to: "/dashboard", label: "首页" },
  { to: "/domains", label: "域名管理" },
  { to: "/records", label: "监控中心" },
  { to: "/bind", label: "交易管理" },
  { to: "/backup", label: "财务中心" },
  { to: "/settings", label: "系统设置" },
] as const;

const SIDEBAR_GROUPS = [
  {
    title: "主功能",
    items: [
      { to: "/dashboard", label: "域名总览", icon: LayoutDashboard },
      { to: "/domains", label: "域名列表", icon: Globe },
      { to: "/bind", label: "批量操作", icon: PackageCheck },
      { to: "/domains", label: "分组管理", icon: FolderTree },
      { to: "/backup", label: "回收站", icon: Recycle },
    ],
  },
  {
    title: "监控与提醒",
    items: [
      { to: "/domains", label: "到期监控", icon: TimerReset, badge: "23" },
      { to: "/dashboard", label: "价格监控", icon: BarChart3, badge: "8" },
      { to: "/dashboard", label: "状态监控", icon: ShieldAlert, badge: "2" },
    ],
  },
  {
    title: "数据导出",
    items: [
      { to: "/backup", label: "数据导出", icon: FileDown },
      { to: "/domains", label: "导入域名", icon: Import },
      { to: "/backup", label: "操作日志", icon: History },
    ],
  },
  {
    title: "工具箱",
    items: [
      { to: "/dashboard", label: "域名估值", icon: Star },
      { to: "/dashboard", label: "外链检测", icon: Link2 },
      { to: "/dashboard", label: "WHOIS 批查", icon: Search },
      { to: "/records", label: "DNS 检测", icon: ListTree },
    ],
  },
] as const;

function AppLayout() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lock = useServerFn(lockSite);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    return () => {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    };
  }, []);

  const activeTop = useMemo(
    () => TOP_NAV.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)),
    [pathname],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-border bg-sidebar/95 shadow-2xl transition-transform lg:static lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[72px]" : "lg:w-[190px]"} w-[220px]`}
      >
        <div className="flex h-[58px] items-center gap-2 border-b border-border px-4">
          <div className="text-3xl font-black italic tracking-[-0.08em] text-primary">DS</div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">DS Hunter</div>
              <div className="truncate text-[10px] text-muted-foreground">域名资产管理终端</div>
            </div>
          )}
          <button
            type="button"
            className="ml-auto grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="关闭侧栏"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="ds-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.title} className="mb-4">
              {!collapsed && (
                <div className="px-3 pb-2 text-[11px] text-muted-foreground">{group.title}</div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarItem
                    key={`${group.title}-${item.label}`}
                    to={item.to}
                    label={item.label}
                    icon={<item.icon className="size-4" />}
                    badge={"badge" in item ? item.badge : undefined}
                    collapsed={collapsed}
                    active={isActive(pathname, item.to, item.label)}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
            {!collapsed && <span>收起侧栏</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="关闭侧栏遮罩"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[58px] shrink-0 items-center border-b border-border bg-background/92 px-3 backdrop-blur-xl sm:px-5">
          <button
            type="button"
            className="mr-2 grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="打开侧栏"
          >
            <Menu className="size-5" />
          </button>

          <nav className="ds-scrollbar hidden h-full min-w-0 flex-1 items-center gap-8 overflow-x-auto px-4 text-sm lg:flex">
            {TOP_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex h-full items-center border-b-2 px-0.5 transition ${
                  activeTop?.to === item.to
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mr-auto min-w-0 text-sm font-medium text-primary lg:hidden">
            {activeTop?.label ?? "DS Hunter"}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <IconButton label="搜索">
              <Search className="size-4" />
            </IconButton>
            <IconButton label="通知" className="relative">
              <Bell className="size-4" />
              <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                12
              </span>
            </IconButton>
            <IconButton label="帮助">
              <CircleHelp className="size-4" />
            </IconButton>
            <div className="hidden items-center gap-2 rounded-full px-2 py-1.5 text-sm md:flex">
              <div className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                D
              </div>
              <span>DS Hunter</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={async () => {
                await lock();
                router.navigate({ to: "/unlock" });
              }}
              aria-label="锁定"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main className="ds-scrollbar min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_40%_0%,hsl(var(--primary)/0.08),transparent_26rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarItem({
  to,
  label,
  icon,
  badge,
  active,
  collapsed,
  onClick,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm transition ${
        active
          ? "border border-primary/35 bg-primary/18 text-primary shadow-[inset_0_1px_0_hsl(var(--primary)/0.16)]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      } ${collapsed ? "justify-center" : ""}`}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && badge && (
        <span className="rounded-full bg-destructive/20 px-1.5 py-0.5 text-[10px] text-warning">
          {badge}
        </span>
      )}
    </Link>
  );
}

function IconButton({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function isActive(pathname: string, to: string, label: string) {
  if (label === "域名总览" && pathname === "/dashboard") return true;
  if (label === "域名列表" && pathname === "/domains") return true;
  if (label === "批量操作" && pathname === "/bind") return true;
  if (label === "数据导出" && pathname === "/backup") return true;
  if (label === "DNS 检测" && pathname === "/records") return true;
  if (label === "系统设置" && pathname === "/settings") return true;
  return (
    pathname.startsWith(`${to}/`) && !["/dashboard", "/domains", "/bind", "/backup"].includes(to)
  );
}
