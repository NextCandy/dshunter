import { createServerFn } from "@tanstack/react-start";
import { requireGate } from "./auth-middleware";
import { recordOperationLog } from "./operation-log.server";
import type { CFResp } from "./registrars/cloudflare.server";

export type BackupRecord = {
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
};

export type BackupZone = {
  domain: string;
  exportedAt: string;
  records: BackupRecord[];
};

type CloudflareDnsRecord = BackupRecord & {
  id: string;
};

type DnsRecordPayload = {
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
};

function normRec(r: Record<string, unknown>): BackupRecord {
  return {
    type: String(r.type),
    name: String(r.name),
    content: String(r.content),
    ttl: Number(r.ttl ?? 1),
    proxied: Boolean(r.proxied),
    priority: r.priority == null ? undefined : Number(r.priority),
  };
}

export const exportZoneRecords = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .validator((d: { domains: string[] }) => d)
  .handler(async ({ data }) => {
    const cf = await import("./registrars/cloudflare.server");
    const zones: BackupZone[] = [];
    const now = new Date().toISOString();
    for (const domain of data.domains) {
      const z = await cf.cfFindZoneByName(domain);
      if (!z) {
        zones.push({ domain, exportedAt: now, records: [] });
        continue;
      }
      const recs = await cf.cfListDNS(z.id);
      zones.push({ domain, exportedAt: now, records: recs.map(normRec) });
    }
    return { zones };
  });

function keyOf(r: BackupRecord) {
  return `${r.type}|${r.name}|${r.content}`;
}

export const diffAgainstLive = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .validator((d: { backup: BackupZone[] }) => d)
  .handler(async ({ data }) => {
    const cf = await import("./registrars/cloudflare.server");
    const results: {
      domain: string;
      onlyInBackup: BackupRecord[];
      onlyInLive: BackupRecord[];
      changed: { key: string; backup: BackupRecord; live: BackupRecord }[];
      missingZone: boolean;
    }[] = [];
    for (const b of data.backup) {
      const z = await cf.cfFindZoneByName(b.domain);
      if (!z) {
        results.push({
          domain: b.domain,
          onlyInBackup: b.records,
          onlyInLive: [],
          changed: [],
          missingZone: true,
        });
        continue;
      }
      const live = (await cf.cfListDNS(z.id)).map(normRec);
      const bMap = new Map(b.records.map((r) => [keyOf(r), r]));
      const lMap = new Map(live.map((r) => [keyOf(r), r]));
      const onlyInBackup = b.records.filter((r) => !lMap.has(keyOf(r)));
      const onlyInLive = live.filter((r) => !bMap.has(keyOf(r)));
      const changed: { key: string; backup: BackupRecord; live: BackupRecord }[] = [];
      for (const [k, br] of bMap) {
        const lr = lMap.get(k);
        if (!lr) continue;
        if (
          br.ttl !== lr.ttl ||
          br.proxied !== lr.proxied ||
          (br.priority ?? -1) !== (lr.priority ?? -1)
        ) {
          changed.push({ key: k, backup: br, live: lr });
        }
      }
      results.push({ domain: b.domain, onlyInBackup, onlyInLive, changed, missingZone: false });
    }
    return { results };
  });

export type PlanOp =
  | { op: "create"; record: BackupRecord }
  | { op: "update"; recordId: string; record: BackupRecord; from: BackupRecord }
  | { op: "delete"; recordId: string; record: BackupRecord }
  | { op: "skip"; record: BackupRecord; reason: string };

export type ZonePlan = {
  domain: string;
  zoneId: string | null;
  missingZone: boolean;
  ops: PlanOp[];
  summary: { create: number; update: number; delete: number; skip: number };
  error?: string;
};

export const planRestoreFromBackup = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .validator(
    (d: { backup: BackupZone[]; strategy: "add-missing" | "overwrite" | "replace-all" }) => d,
  )
  .handler(async ({ data }): Promise<{ plans: ZonePlan[] }> => {
    const cf = await import("./registrars/cloudflare.server");
    const plans: ZonePlan[] = [];
    for (const b of data.backup) {
      const z = await cf.cfFindZoneByName(b.domain);
      if (!z) {
        plans.push({
          domain: b.domain,
          zoneId: null,
          missingZone: true,
          ops: [],
          summary: { create: 0, update: 0, delete: 0, skip: 0 },
          error: "zone not found in Cloudflare",
        });
        continue;
      }
      const live = (await cf.cfListDNS(z.id)) as CloudflareDnsRecord[];
      const liveByKey = new Map(live.map((r) => [keyOf(normRec(r)), r]));
      const backupKeys = new Set(b.records.map(keyOf));
      const ops: PlanOp[] = [];

      if (data.strategy === "replace-all") {
        for (const lr of live) {
          const nr = normRec(lr);
          if (!backupKeys.has(keyOf(nr))) {
            ops.push({ op: "delete", recordId: lr.id, record: nr });
          }
        }
      }

      for (const rec of b.records) {
        const existing = liveByKey.get(keyOf(rec));
        if (existing) {
          if (data.strategy === "add-missing") {
            ops.push({ op: "skip", record: rec, reason: "已存在，按策略跳过" });
            continue;
          }
          const from = normRec(existing);
          if (
            from.ttl === rec.ttl &&
            from.proxied === rec.proxied &&
            (from.priority ?? -1) === (rec.priority ?? -1)
          ) {
            ops.push({ op: "skip", record: rec, reason: "属性一致，无需更新" });
          } else {
            ops.push({ op: "update", recordId: existing.id, record: rec, from });
          }
        } else {
          ops.push({ op: "create", record: rec });
        }
      }

      const summary = { create: 0, update: 0, delete: 0, skip: 0 };
      for (const o of ops) summary[o.op]++;
      plans.push({ domain: b.domain, zoneId: z.id, missingZone: false, ops, summary });
    }
    return { plans };
  });

export const applyRestorePlan = createServerFn({ method: "POST" })
  .middleware([requireGate])
  .validator((d: { plans: ZonePlan[] }) => d)
  .handler(async ({ data }) => {
    const cf = await import("./registrars/cloudflare.server");
    const out: {
      domain: string;
      created: number;
      updated: number;
      deleted: number;
      skipped: number;
      errors: string[];
    }[] = [];
    for (const plan of data.plans) {
      const row = {
        domain: plan.domain,
        created: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        errors: [] as string[],
      };
      if (plan.missingZone || !plan.zoneId) {
        row.errors.push(plan.error ?? "zone missing");
        out.push(row);
        continue;
      }
      const zoneId = plan.zoneId;
      for (const op of plan.ops) {
        try {
          if (op.op === "skip") {
            row.skipped++;
            continue;
          }
          if (op.op === "delete") {
            const r = await cf.cfDeleteDNS(zoneId, op.recordId);
            if (r.success) row.deleted++;
            else row.errors.push(`delete ${op.record.name}: ${cf.cfErr(r as CFResp<unknown>)}`);
            continue;
          }
          const payload: DnsRecordPayload = {
            type: op.record.type,
            name: op.record.name,
            content: op.record.content,
            ttl: op.record.ttl,
          };
          if (["A", "AAAA", "CNAME"].includes(op.record.type)) payload.proxied = op.record.proxied;
          if (op.record.priority !== undefined) payload.priority = op.record.priority;
          if (op.op === "create") {
            const r = await cf.cfCreateDNS(zoneId, payload);
            if (r.success) row.created++;
            else row.errors.push(`create ${op.record.name}: ${cf.cfErr(r)}`);
          } else {
            const r = await cf.cfUpdateDNS(zoneId, op.recordId, payload);
            if (r.success) row.updated++;
            else row.errors.push(`update ${op.record.name}: ${cf.cfErr(r)}`);
          }
        } catch (e: unknown) {
          row.errors.push(`${op.record.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      out.push(row);
    }
    const totals = out.reduce(
      (sum, row) => ({
        created: sum.created + row.created,
        updated: sum.updated + row.updated,
        deleted: sum.deleted + row.deleted,
        skipped: sum.skipped + row.skipped,
        errors: sum.errors + row.errors.length,
      }),
      { created: 0, updated: 0, deleted: 0, skipped: 0, errors: 0 },
    );
    await recordOperationLog({
      category: "backup",
      action: "dns_restore.apply",
      title: "应用 DNS 恢复计划",
      detail: `${out.length} 个 Zone，创建 ${totals.created}，更新 ${totals.updated}，删除 ${totals.deleted}，错误 ${totals.errors}。`,
      entityType: "dns-restore",
      severity: totals.errors > 0 ? "warning" : "success",
      metadata: totals,
    });
    return { results: out };
  });
