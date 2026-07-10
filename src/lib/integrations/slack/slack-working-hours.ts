const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isWithinWorkingHours(date: Date): boolean {
  if (isWeekend(date)) return false;
  const hour = date.getHours();
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

export function isKazPanelBusinessHours(date = new Date()): boolean {
  if (isWeekend(date)) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins >= 8 * 60 && mins < 16 * 60;
}
