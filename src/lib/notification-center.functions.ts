import { createServerFn } from "@tanstack/react-start";
import { requireGate } from "./auth-middleware";
import { listNotificationCenter as listCenter } from "./notification-center.server";

export type {
  NotificationCenterItem,
  NotificationCenterResult,
  NotificationKind,
  NotificationSeverity,
  NotificationSummary,
  NotificationTarget,
} from "./notification-center.server";

export const listNotificationCenter = createServerFn({ method: "GET" })
  .middleware([requireGate])
  .handler(async () => listCenter());
