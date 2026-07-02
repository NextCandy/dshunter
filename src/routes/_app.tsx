import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkGate, lockSite } from "@/lib/gate.functions";
import { Button } from "@/components/ui/button";
import {
  Globe,
  Link2,
  ListTree,
  Settings,
  LogOut,
  LayoutDashboard,
  DatabaseBackup,
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
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border p-3">
        <div className="mb-2 flex items-center gap-2.5 px-2 py-3">
          <div className="flex size-9 items-center justify-center rounded-lg border bg-muted/50">
            <Globe className="size-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold leading-tight tracking-tight">dshunter</div>
            <div className="text-[11px] text-muted-foreground">域名运营工作台</div>
          </div>
        </div>
        <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          域名
        </div>
        <NavItem to="/" icon={<LayoutDashboard className="size-4" />}>
          仪表盘
        </NavItem>
        <NavItem to="/domains" icon={<Globe className="size-4" />}>
          域名列表
        </NavItem>
        <NavItem to="/bind" icon={<Link2 className="size-4" />}>
          批量绑定
        </NavItem>
        <NavItem to="/records" icon={<ListTree className="size-4" />}>
          解析记录
        </NavItem>
        <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          系统
        </div>
        <NavItem to="/backup" icon={<DatabaseBackup className="size-4" />}>
          备份与恢复
        </NavItem>
        <NavItem to="/settings" icon={<Settings className="size-4" />}>
          设置
        </NavItem>
        <div className="mt-auto border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={async () => {
              await lock();
              router.navigate({ to: "/unlock" });
            }}
          >
            <LogOut className="size-4 mr-2" /> 锁定
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      activeOptions={{ exact: to === "/" }}
      activeProps={{
        className:
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm bg-accent font-medium text-foreground",
      }}
    >
      {icon}
      {children}
    </Link>
  );
}
