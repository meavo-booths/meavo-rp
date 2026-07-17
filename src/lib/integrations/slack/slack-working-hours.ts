import {
  getHourInScriptTz,
  getIsoWeekdayInScriptTz,
} from "@/lib/integrations/slack/script-timezone";

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

export function isWeekend(date: Date): boolean {
  const day = getIsoWeekdayInScriptTz(date);
  return day === 6 || day === 7;
}

export function isWithinWorkingHours(date: Date): boolean {
  if (isWeekend(date)) return false;
  const hour = getHourInScriptTz(date);
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

export function getWorkingHoursBetween(startDate: Date, endDate: Date): number {
  if (endDate <= startDate) return 0;

  let totalMs = 0;
  const cursor = new Date(startDate.getTime());

  while (cursor < endDate) {
    const dayStart = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      WORK_START_HOUR,
      0,
      0,
      0,
    );
    const dayEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      WORK_END_HOUR,
      0,
      0,
      0,
    );

    if (!isWeekend(cursor)) {
      const segmentStart = cursor > dayStart ? cursor : dayStart;
      const segmentEnd = endDate < dayEnd ? endDate : dayEnd;
      if (segmentEnd > segmentStart) {
        totalMs += segmentEnd.getTime() - segmentStart.getTime();
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(WORK_START_HOUR, 0, 0, 0);
  }

  return totalMs / 3_600_000;
}

export function getProductionDeadlineEndMoment(deadlineStart: Date): Date | null {
  if (Number.isNaN(deadlineStart.getTime())) return null;
  return new Date(
    deadlineStart.getFullYear(),
    deadlineStart.getMonth(),
    deadlineStart.getDate(),
    WORK_END_HOUR,
    0,
    0,
    0,
  );
}

export function toSingleDecimal(num: number): number {
  return Math.floor(num * 10) / 10;
}

export function workingDayHours(): number {
  return WORK_END_HOUR - WORK_START_HOUR;
}

/** KAZ/VAR panel order window: Mon–Fri 08:00–16:00 Europe/Sofia. */
export function isKazPanelBusinessHours(date = new Date()): boolean {
  const day = getIsoWeekdayInScriptTz(date);
  if (day < 1 || day > 5) return false;
  const hour = getHourInScriptTz(date);
  return hour >= 8 && hour < 16;
}
