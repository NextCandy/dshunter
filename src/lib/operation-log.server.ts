import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type OperationLogCategory =
  | "settings"
  | "registrar"
  | "domains"
  | "backup"
  | "dns"
  | "sync"
  | "system";

export type OperationLogSeverity = "info" | "success" | "warning" | "danger";

export type OperationLogValue =
  | string
  | number
  | boolean
  | null
  | OperationLogValue[]
  | { [key: string]: OperationLogValue };

export type OperationLogItem = {
  id: string;
  at: string;
  actor: string;
  category: OperationLogCategory;
  action: string;
  title: string;
  detail?: string;
  entityType?: string;
  entityId?: string;
  severity: OperationLogSeverity;
  metadata?: Record<string, OperationLogValue>;
};

export type OperationLogInput = Omit<OperationLogItem, "id" | "at" | "actor" | "severity"> & {
  actor?: string;
  at?: string;
  severity?: OperationLogSeverity;
};

type Store = { v: 1; items: OperationLogItem[] };

const FILE = process.env.OPERATION_LOG_FILE || join(process.cwd(), "data", "operation-log.json");
const MAX_ITEMS = Number(process.env.OPERATION_LOG_MAX_ITEMS || 800);
const REDACTED = "***REDACTED***";

let cache: Store | null = null;

function emptyStore(): Store {
  return { v: 1, items: [] };
}

function cleanText(value: unknown, max = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = [...value]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code <= 31 || code === 127 ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return text ? [...text].slice(0, max).join("") : undefined;
}

function cleanCategory(value: unknown): OperationLogCategory {
  const allowed: OperationLogCategory[] = [
    "settings",
    "registrar",
    "domains",
    "backup",
    "dns",
    "sync",
    "system",
  ];
  return allowed.includes(value as OperationLogCategory)
    ? (value as OperationLogCategory)
    : "system";
}

function cleanSeverity(value: unknown): OperationLogSeverity {
  const allowed: OperationLogSeverity[] = ["info", "success", "warning", "danger"];
  return allowed.includes(value as OperationLogSeverity) ? (value as OperationLogSeverity) : "info";
}

function isSensitiveKey(key: string) {
  return /token|secret|password|passwd|cookie|session|authorization|credential|private.?key|api.?key/i.test(
    key,
  );
}

function sanitizeValue(value: unknown, depth = 0): OperationLogValue {
  if (depth > 3) return null;
  if (value == null) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return cleanText(value, 500) ?? "";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return String(value);

  const out: Record<string, OperationLogValue> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
    const safeKey = cleanText(key, 80);
    if (!safeKey) continue;
    out[safeKey] = isSensitiveKey(safeKey) ? REDACTED : sanitizeValue(child, depth + 1);
  }
  return out;
}

function sanitizeMetadata(value: unknown): Record<string, OperationLogValue> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const sanitized = sanitizeValue(value);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, OperationLogValue>)
    : undefined;
}

function migrate(raw: unknown): OperationLogItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<OperationLogItem>;
  const title = cleanText(row.title, 180);
  const action = cleanText(row.action, 120);
  if (!title || !action) return null;
  const at =
    typeof row.at === "string" && Number.isFinite(Date.parse(row.at))
      ? new Date(row.at).toISOString()
      : new Date().toISOString();
  return {
    id: cleanText(row.id, 80) ?? randomUUID(),
    at,
    actor: cleanText(row.actor, 80) ?? "admin",
    category: cleanCategory(row.category),
    action,
    title,
    detail: cleanText(row.detail, 500),
    entityType: cleanText(row.entityType, 80),
    entityId: cleanText(row.entityId, 160),
    severity: cleanSeverity(row.severity),
    metadata: sanitizeMetadata(row.metadata),
  };
}

async function readStore(): Promise<Store> {
  if (cache) return cache;
  try {
    const txt = await readFile(FILE, "utf8");
    const parsed = JSON.parse(txt);
    const items = Array.isArray(parsed?.items)
      ? parsed.items.flatMap((item: unknown) => {
          const migrated = migrate(item);
          return migrated ? [migrated] : [];
        })
      : [];
    cache = { v: 1, items };
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code !== "ENOENT") {
      console.error(
        "[operation-log] read failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
    cache = emptyStore();
  }
  return cache;
}

async function writeStore(store: Store) {
  cache = store;
  await mkdir(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, FILE);
}

export async function recordOperationLog(
  input: OperationLogInput,
): Promise<OperationLogItem | null> {
  const title = cleanText(input.title, 180);
  const action = cleanText(input.action, 120);
  if (!title || !action) return null;
  const item: OperationLogItem = {
    id: randomUUID(),
    at:
      input.at && Number.isFinite(Date.parse(input.at))
        ? new Date(input.at).toISOString()
        : new Date().toISOString(),
    actor: cleanText(input.actor, 80) ?? "admin",
    category: cleanCategory(input.category),
    action,
    title,
    detail: cleanText(input.detail, 500),
    entityType: cleanText(input.entityType, 80),
    entityId: cleanText(input.entityId, 160),
    severity: cleanSeverity(input.severity ?? "info"),
    metadata: sanitizeMetadata(input.metadata),
  };

  try {
    const store = await readStore();
    const max = Number.isFinite(MAX_ITEMS) && MAX_ITEMS > 0 ? MAX_ITEMS : 800;
    const next = { v: 1 as const, items: [item, ...store.items].slice(0, max) };
    await writeStore(next);
    return item;
  } catch (error) {
    console.error(
      "[operation-log] write failed:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export async function listOperationLogs(options?: {
  category?: OperationLogCategory | "all";
  limit?: number;
}): Promise<OperationLogItem[]> {
  const store = await readStore();
  const limit = Math.min(Math.max(Number(options?.limit ?? 100), 1), 300);
  const category = options?.category;
  return store.items
    .filter((item) => !category || category === "all" || item.category === category)
    .slice(0, limit);
}
