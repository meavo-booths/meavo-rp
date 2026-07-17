const SCRIPT_TZ = process.env.RP_SCRIPT_TIMEZONE ?? "Europe/Sofia";

export function getScriptTimezone(): string {
  return SCRIPT_TZ;
}

export function getHourInScriptTz(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: SCRIPT_TZ,
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function getIsoWeekdayInScriptTz(date = new Date()): number {
  const token = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCRIPT_TZ,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[token] ?? 0;
}

export function isWorkingWeekdayInScriptTz(date = new Date()): boolean {
  const day = getIsoWeekdayInScriptTz(date);
  return day >= 1 && day <= 5;
}

export function getDateKeyInScriptTz(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCRIPT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getCalendarDayInScriptTz(date = new Date()): string {
  return getDateKeyInScriptTz(date);
}
