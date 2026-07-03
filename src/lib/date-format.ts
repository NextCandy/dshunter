const DEFAULT_TIME_ZONE = "Asia/Shanghai";

function getTimeZone() {
  if (typeof process !== "undefined" && process.env?.TZ) return process.env.TZ;
  return DEFAULT_TIME_ZONE;
}

export function formatDate(
  iso: string | number | Date | null | undefined,
  locale = "zh-CN",
  options: Intl.DateTimeFormatOptions = {},
) {
  if (!iso) return "--";
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat(locale, {
    timeZone: getTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...options,
  }).format(date);
}

export function formatDateTime(iso: string | number | Date | null | undefined, locale = "zh-CN") {
  return formatDate(iso, locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
