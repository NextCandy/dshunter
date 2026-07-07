import { createServerFn } from "@tanstack/react-start";
import { requireGate } from "./auth-middleware";
import { listOperationLogs as listLogs, type OperationLogCategory } from "./operation-log.server";

export type {
  OperationLogCategory,
  OperationLogItem,
  OperationLogSeverity,
} from "./operation-log.server";

export const listOperationLogs = createServerFn({ method: "GET" })
  .middleware([requireGate])
  .inputValidator(
    (data: { category?: OperationLogCategory | "all"; limit?: number } | undefined) => data ?? {},
  )
  .handler(async ({ data }) => {
    return { rows: await listLogs(data) };
  });
