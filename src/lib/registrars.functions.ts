import { createServerFn } from "@tanstack/react-start";
import { requireGate } from "./auth-middleware";
import { normalizeDomain } from "./domain-utils";
import { getSecretPresence } from "./secrets.server";

export type Registrar =
  | "spaceship"
  | "dynadot"
  | "cf-registrar"
  | "namecheap"
  | "aliyun"
  | "tencent"
  | "west";

export const getTokenStatus = createServerFn({ method: "GET" })
  .middleware([requireGate])
  .handler(async () => {
    const p = await getSecretPresence();
    return {
      cloudflare: p.CLOUDFLARE_API_TOKEN,
      spaceship: p.SPACESHIP_API_KEY && p.SPACESHIP_API_SECRET,
      dynadot: p.DYNADOT_API_KEY,
      namecheap: p.NAMECHEAP_API_USER && p.NAMECHEAP_API_KEY && p.NAMECHEAP_CLIENT_IP,
      aliyun: p.ALIYUN_ACCESS_KEY_ID && p.ALIYUN_ACCESS_KEY_SECRET,
      tencent: p.TENCENT_SECRET_ID && p.TENCENT_SECRET_KEY,
      west: p.WEST_USERNAME && p.WEST_API_PASSWORD,
    };
  });

export const listRegistrarDomains = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .inputValidator((d: { registrar: Registrar; accountId?: string }) => d)
  .handler(async ({ data }) => {
    let raw: string[] = [];
    if (data.registrar === "spaceship") {
      const { spaceshipListDomains } = await import("./registrars/spaceship.server");
      raw = await spaceshipListDomains();
    } else if (data.registrar === "dynadot") {
      const { dynadotListDomains } = await import("./registrars/dynadot.server");
      raw = await dynadotListDomains();
    } else if (data.registrar === "cf-registrar") {
      if (!data.accountId) throw new Error("需要 accountId");
      const { cfRegListDomains } = await import("./registrars/cf-registrar.server");
      raw = await cfRegListDomains(data.accountId);
    } else if (data.registrar === "namecheap") {
      const { namecheapListDomains } = await import("./registrars/namecheap.server");
      raw = await namecheapListDomains();
    } else if (data.registrar === "aliyun") {
      const { aliyunListDomains } = await import("./registrars/aliyun.server");
      raw = await aliyunListDomains();
    } else if (data.registrar === "tencent") {
      const { tencentListDomains } = await import("./registrars/tencent.server");
      raw = await tencentListDomains();
    } else if (data.registrar === "west") {
      const { westListDomains } = await import("./registrars/west.server");
      raw = await westListDomains();
    }
    const set = new Set<string>();
    for (const d of raw) {
      const n = normalizeDomain(d);
      if (n) set.add(n);
    }
    return { domains: [...set].sort() };
  });
