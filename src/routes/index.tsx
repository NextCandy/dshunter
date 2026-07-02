import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  Home,
  MoreVertical,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DS Hunter · 更聪明的域名资产管理未来" },
      {
        name: "description",
        content: "集中拉取、管理、监控域名资产，自动同步注册商数据、追踪到期风险、统一管理 DNS。",
      },
    ],
  }),
  component: LandingPage,
});

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4";

function LandingPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, []);

  async function toggleVideo() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play().catch(() => undefined);
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col">
      <nav className="relative z-20 flex items-center justify-between px-6 py-5 font-body md:px-12 lg:px-20">
        <Link to="/" className="text-xl font-semibold tracking-tight text-foreground">
          ✦ DS Hunter
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {["Home", "Pricing", "About", "Contact"].map((item) => (
            <a
              key={item}
              href={item === "Home" ? "/" : `#${item.toLowerCase()}`}
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              {item}
            </a>
          ))}
        </div>
        <Button asChild className="rounded-full px-5 text-sm font-medium">
          <Link to="/domains">进入控制台</Link>
        </Button>
      </nav>

      <main className="relative flex flex-1 items-start justify-center overflow-hidden px-4 pt-10 md:pt-12">
        <video
          ref={videoRef}
          muted
          autoPlay
          loop
          preload="auto"
          playsInline
          className="absolute inset-0 z-0 h-full w-full object-cover"
          src={HERO_VIDEO}
        />
        <div className="absolute inset-0 z-[1] bg-background/70" />
        <div className="absolute inset-x-0 bottom-0 z-[2] h-40 bg-gradient-to-t from-background via-background/85 to-transparent" />

        <div className="relative z-10 flex w-full flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground font-body"
          >
            现已支持 GPT-5 智能资产分析 ✨
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-xl text-center font-display text-5xl leading-[0.95] tracking-tight text-foreground md:text-6xl lg:text-[5rem]"
          >
            <span className="italic">更聪明</span>的域名资产管理未来
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-4 max-w-[650px] text-center font-body text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            集中拉取、管理、监控你的域名资产，自动同步注册商数据、追踪到期风险、统一管理
            DNS，让域名组合始终清晰可控。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-5 flex items-center gap-3"
          >
            <Button asChild className="rounded-full px-6 py-5 text-sm font-medium font-body">
              <Link to="/domains">进入控制台</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={toggleVideo}
              aria-label={paused ? "播放背景视频" : "暂停背景视频"}
              className="h-11 w-11 rounded-full border-0 bg-background shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:bg-background/80"
            >
              <Play className="h-4 w-4 fill-foreground" />
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-8 w-full max-w-5xl"
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function DashboardPreview() {
  const sidebar = [
    ["Home", undefined, Home],
    ["Domains", "2842", Database],
    ["Monitoring", undefined, Clock3],
    ["Renewals", undefined, CheckCircle2],
    ["DNS", undefined, ShieldCheck],
    ["Portfolio", undefined, Database],
    ["Registrar", undefined, Settings],
    ["Accounts", undefined, Home],
  ] as const;
  const workflow = ["Smart Sync", "Expiry Alerts", "DNS Checks", "Settings"];
  const actions = [
    "Sync",
    "Import",
    "Transfer",
    "Renew",
    "DNS Check",
    "Create Report",
    "Customize",
  ];
  const registrars = [
    ["Alibaba Cloud", "1,204"],
    ["Tencent Cloud", "682"],
    ["Cloudflare", "356"],
  ];
  const activities = [
    ["2026-05-28", "Synced from registrar", "dshunter.com", "Completed"],
    ["2026-05-27", "DNS check", "dshunter.net", "Completed"],
    ["2026-05-26", "Renewal reminder", "dshunter.io", "Pending"],
    ["2026-05-25", "Portfolio value updated", "hunterds.com", "Completed"],
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden p-3 md:p-4"
      style={{
        background: "rgba(255, 255, 255, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.5)",
        boxShadow: "var(--shadow-dashboard)",
      }}
    >
      <div className="overflow-hidden rounded-xl bg-background text-[11px] select-none pointer-events-none">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-[10px] font-semibold text-primary-foreground">
            DS
          </div>
          <div className="flex items-center gap-1 font-semibold">
            DS Hunter
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="ml-4 hidden h-8 flex-1 items-center rounded-full bg-secondary px-3 text-muted-foreground md:flex">
            <Search className="mr-2 h-3.5 w-3.5" />
            Search domains, registrar, notes
            <span className="ml-auto rounded bg-background px-1.5 py-0.5 font-mono">⌘K</span>
          </div>
          <button className="ml-auto rounded-full bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground md:ml-0">
            Sync Domains
          </button>
          <Bell className="h-4 w-4 text-muted-foreground" />
          <div className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-[10px] font-semibold">
            WG
          </div>
        </div>

        <div className="flex">
          <aside className="hidden w-40 shrink-0 border-r border-border p-3 md:block">
            <div className="space-y-1">
              {sidebar.map(([label, badge, Icon], index) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                    index === 0 ? "bg-secondary text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  {badge && (
                    <span className="ml-auto rounded-full bg-background px-1.5 py-0.5 text-[9px]">
                      {badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 text-[10px] font-medium uppercase text-muted-foreground">
              Workflows
            </div>
            <div className="mt-2 space-y-1 text-muted-foreground">
              {workflow.map((item) => (
                <div key={item} className="rounded-lg px-2 py-1.5">
                  {item}
                </div>
              ))}
            </div>
          </aside>

          <section className="flex-1 bg-secondary/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Welcome, Gang</div>
              <div className="text-muted-foreground">May 28, 2026</div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <span
                  key={action}
                  className={`rounded-full px-3 py-1.5 text-[10px] ${
                    index === 0
                      ? "bg-accent text-accent-foreground"
                      : "bg-background text-muted-foreground"
                  }`}
                >
                  {action}
                </span>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium">Domain Portfolio Value</span>
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                </div>
                <div className="text-2xl font-semibold">¥ 2,456,789</div>
                <div className="text-muted-foreground">estimated</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Active Domains</div>
                    <div className="font-semibold text-success">+2,456</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Expiring Soon</div>
                    <div className="font-semibold text-warning">23</div>
                  </div>
                </div>
                <svg className="mt-3 h-20 w-full" viewBox="0 0 360 90" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="portfolioPreviewFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,72 C36,64 52,48 84,52 C118,56 132,24 162,30 C198,36 207,68 242,52 C282,34 306,28 360,18 L360,90 L0,90 Z"
                    fill="url(#portfolioPreviewFill)"
                  />
                  <path
                    d="M0,72 C36,64 52,48 84,52 C118,56 132,24 162,30 C198,36 207,68 242,52 C282,34 306,28 360,18"
                    fill="none"
                    stroke="hsl(var(--accent))"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium">Registrar Accounts</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Plus className="h-3.5 w-3.5" />
                    <MoreVertical className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div>
                  {registrars.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between py-3 text-xs">
                      <span>{name}</span>
                      <span className="font-mono font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-border bg-background p-4">
              <div className="mb-2 font-medium">Recent Domain Activity</div>
              <table className="w-full text-left">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 font-medium">Date</th>
                    <th className="py-1 font-medium">Description</th>
                    <th className="py-1 font-medium">Domain</th>
                    <th className="py-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map(([date, description, domain, status]) => (
                    <tr key={`${date}-${domain}`} className="border-t border-border">
                      <td className="py-2 text-muted-foreground">{date}</td>
                      <td className="py-2">{description}</td>
                      <td className="py-2 font-mono">{domain}</td>
                      <td
                        className={`py-2 font-medium ${
                          status === "Pending" ? "text-warning" : "text-success"
                        }`}
                      >
                        {status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
