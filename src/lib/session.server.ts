import { useSession } from "@tanstack/react-start/server";

export type GateSession = { unlocked?: boolean };

export const sessionConfig = {
  password: process.env.SESSION_SECRET!,
  name: "dm-gate",
  maxAge: 60 * 60 * 24 * 7,
  cookie: {
    httpOnly: true,
    // 默认启用 Secure（仅 HTTPS 下发）。内网 http 部署时设 COOKIE_SECURE=false，
    // 否则解锁后 Cookie 不会下发，会立刻被踢回登录页。
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "lax" as const,
    path: "/",
  },
};

export async function getGateSession() {
  return useSession<GateSession>(sessionConfig);
}

export async function requireUnlocked() {
  const s = await getGateSession();
  if (!s.data.unlocked) {
    throw new Response("Locked", { status: 401 });
  }
}
