import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "motion/react";
import { unlockSite } from "@/lib/gate.functions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Lock } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
      <Card className="relative overflow-hidden border-border/60 bg-card/80 p-8 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-primary/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-10 top-0 h-24 bg-linear-to-b from-primary/20 via-transparent to-transparent" />
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 drop-shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
            <Lock className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">DS Hunter</h1>
          <p className="text-sm text-muted-foreground">请输入后台账号和密码</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            type="email"
            value={email}
            autoComplete="username"
            autoFocus
            onChange={(e) => setEmail(e.target.value)}
            placeholder="账号邮箱"
          />
          <Input
            type="password"
            value={pw}
            autoComplete="current-password"
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
            onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
            placeholder="密码"
          />
          {capsLock && (
            <p className="text-xs text-amber-600 dark:text-amber-400">大写锁定已开启</p>
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
          <Button className="w-full" disabled={loading || !email || !pw}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                登录中…
              </>
            ) : (
              "登录"
            )}
          </Button>
        </form>
      </Card>
      </div>
    </div>
  );
}
