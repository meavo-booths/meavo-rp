/** Working-day deadline helpers ported from legacy LoggerLogic.js. */

const STANDARD_PANEL_WORKING_DAYS = 13;
const STANDARD_PART_WORKING_DAYS = 5;

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function nthWorkingDayInclusiveFromEntry(entryDate: Date, n: number): Date {
  const d = new Date(entryDate.getTime());
  d.setHours(12, 0, 0, 0);
  let count = 1;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) count++;
  }
  return d;
}

function isOutsideBusinessHours(entryDate: Date): boolean {
  const hour = entryDate.getHours();
  return hour < 9 || hour >= 17;
}

function nextWorkingDayAfterEntry(entryDate: Date): Date {
  const d = new Date(entryDate.getTime());
  d.setHours(12, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (isWeekend(d));
  return d;
}

function applyAfterHoursDeadlineNudge(entryDate: Date, baseDate: Date): Date {
  if (isOutsideBusinessHours(entryDate)) {
    return nextWorkingDayAfterEntry(baseDate);
  }
  return baseDate;
}

export function computeStandardPanelDeadline(entryDate: Date): Date {
  const base = nthWorkingDayInclusiveFromEntry(
    entryDate,
    STANDARD_PANEL_WORKING_DAYS,
  );
  return applyAfterHoursDeadlineNudge(entryDate, base);
}

export function computeShippingDeadlineFromUrgency(
  urgency: string | null | undefined,
  entryDate: Date,
): Date | null {
  if ((urgency ?? "").toLowerCase() === "urgent") return null;
  return computeStandardPanelDeadline(entryDate);
}

function computePartOrStockDeadline(
  urgency: string | null | undefined,
  entryDate: Date,
): Date {
  const base =
    (urgency ?? "").toLowerCase() === "urgent"
      ? nextWorkingDayAfterEntry(entryDate)
      : nthWorkingDayInclusiveFromEntry(entryDate, STANDARD_PART_WORKING_DAYS);
  return applyAfterHoursDeadlineNudge(entryDate, base);
}

/** Auto due date from column K item type + urgency (LoggerLogic.js). */
export function computeAutoDueDate(
  itemTypeK: string,
  urgency: string | null | undefined,
  entryDate: Date,
): Date | null {
  const k = itemTypeK.trim().toUpperCase();
  if (k === "STOCK" || k === "PARTS") {
    return computePartOrStockDeadline(urgency, entryDate);
  }
  if ((urgency ?? "").toLowerCase() === "urgent") return null;
  return computeStandardPanelDeadline(entryDate);
}
