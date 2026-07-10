import { prisma } from "@/lib/prisma";

export async function getSlackAutomationState(key: string): Promise<string | null> {
  const row = await prisma.rpAutomationState.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSlackAutomationState(
  key: string,
  value: string,
): Promise<void> {
  await prisma.rpAutomationState.upsert({
    where: { key },
    create: { key, value },
    update: { value, updatedAt: new Date() },
  });
}

export async function hasSlackAutomationState(key: string): Promise<boolean> {
  const value = await getSlackAutomationState(key);
  return value === "1" || Boolean(value);
}

export function escalationKey(rpNum: string, hour: number): string {
  return `SLACK_ALERT_SENT_${rpNum}_${hour}H`;
}

export function productionApproachingKey(
  rpNum: string,
  deadline: Date,
): string {
  const ymd = deadline.toISOString().slice(0, 10).replace(/-/g, "");
  return `SLACK_PROD_DATE_APPROACH_${rpNum}_${ymd}`;
}

export function productionDeadlineReachedKey(
  rpNum: string,
  deadline: Date,
): string {
  const ymd = deadline.toISOString().slice(0, 10).replace(/-/g, "");
  return `SLACK_PROD_DATE_REACHED_${rpNum}_${ymd}`;
}

export function missingWorkshopNoteWarnKey(
  recordType: string,
  rpNum: string,
): string {
  return `MWN_STD_${recordType.toLowerCase()}_${rpNum.replace(/\s+/g, "").toUpperCase()}`;
}

export function factoryDeadlineSentKey(
  factory: string,
  ruleId: string,
  rpNum: string,
  dateKey: string,
): string {
  return `FDL_${factory}_${ruleId}_${rpNum}_${dateKey}`;
}
