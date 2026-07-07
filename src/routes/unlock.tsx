import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "motion/react";
import { unlockSite } from "@/lib/gate.functions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DeckMark } from "@/components/deck-mark";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/unlock")({
  head: () => ({
    meta: [
      { title: "登录 · dshunter" },
      { name: "description", content: "登录 dshunter 域名管理控制台。" },
    ],
  }),
  component: UnlockPage,
});

function UnlockPage() {
  const router = useRouter();
  const unlock = useServerFn(unlockSite);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await unlock({ data: { email, password: pw } });
      if (r.ok) {
        await router.navigate({ to: "/dashboard" });
      } else {
        setErr("账号或密码错误");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-blueprint opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />

      <div className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
        <Card className="relative overflow-hidden border-border/60 bg-card/85 p-8 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-primary/70 to-transparent" />

          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary shadow-lg shadow-primary/25 ring-1 ring-inset ring-primary/25">
              <DeckMark className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight">DS Hunter</h1>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Command Deck · 登录
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="email"
              value={email}
              autoComplete="username"
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              placeholder="账号邮箱"
              className="font-mono"
            />
            <Input
              type="password"
              value={pw}
              autoComplete="current-password"
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              placeholder="密码"
              className="font-mono"
            />
            {capsLock && (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <span className="signal signal-warning" />
                大写锁定已开启
              </p>
            )}
            {err && (
              <motion.div
                initial={{ x: 0 }}
                animate={{ x: [0, -6, 6, -4, 4, 0] }}
                transition={{ duration: 0.28 }}
              >
                <Alert variant="destructive" className="border-destructive/70 bg-destructive/10">
                  <AlertDescription>账号或密码错误</AlertDescription>
                </Alert>
              </motion.div>
            )}
            <Button className="w-full font-medium" disabled={loading || !email || !pw}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  登录中…
                </>
              ) : (
                "进入指挥台"
              )}
            </Button>
          </form>
        </Card>

        <div className="mt-4 text-center">
          <Link
            to="/"
            className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← 返回资产台账
          </Link>
        </div>
      </div>
    </div>
  );
}
