// Pure ET-date helper. The Deno chat function uses date-fns/date-fns-tz; here we
// keep tool-core dependency-free with Intl (en-CA → YYYY-MM-DD; the IANA zone
// handles DST). Mirrors the output of shared/dateUtils.ts:getTodayInET().

export function getTodayInET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Format an arbitrary Date in ET as YYYY-MM-DD. */
export function getDateInET(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
