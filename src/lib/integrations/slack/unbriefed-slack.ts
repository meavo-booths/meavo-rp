import { prisma } from "@/lib/prisma";

import {
  escalationKey,
  hasSlackAutomationState,
  productionApproachingKey,
  productionDeadlineReachedKey,
  setSlackAutomationState,
} from "@/lib/integrations/slack/slack-automation-state";
import { openDmAndPost } from "@/lib/integrations/slack/slack-client";
import {
  PRODUCTION_WARNING_USER_IDS,
  UNBRIEFED_ESCALATION_USER_IDS,
} from "@/lib/integrations/slack/slack-config";
import {
  getProductionDeadlineEndMoment,
  getWorkingHoursBetween,
  isWithinWorkingHours,
  toSingleDecimal,
  workingDayHours,
} from "@/lib/integrations/slack/slack-working-hours";

const ESCALATION_HOURS = [1, 4, 8];
const PRODUCTION_WARNING_WORKING_DAYS = 4;

function isExcludedItem(itemType: string | null): boolean {
  const upper = (itemType ?? "").trim().toUpperCase();
  return ["STOCK", "PART", "PARTS", "OTHER PARTS"].includes(upper);
}

function isProductionStatus(status: string | null): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return s === "BRIEFED" || s === "IN PRODUCTION";
}

function escalationLabel(hour: number): string {
  if (hour === 1) return "First escalation";
  if (hour === 4) return "Second escalation";
  if (hour === 8) return "Third escalation";
  return `Escalation ${hour}h`;
}

async function clearEscalationMarkers(rpNum: string): Promise<void> {
  for (const hour of ESCALATION_HOURS) {
    await prisma.rpAutomationState.deleteMany({
      where: { key: escalationKey(rpNum, hour) },
    });
  }
}

async function getNextEscalationHour(
  workingHoursElapsed: number,
  rpNum: string,
): Promise<number> {
  for (const hour of ESCALATION_HOURS) {
    if (workingHoursElapsed >= hour) {
      const key = escalationKey(rpNum, hour);
      if (!(await hasSlackAutomationState(key))) return hour;
    }
  }
  return 0;
}

export async function runUnbriefedUrgentPanelsCheck(): Promise<{
  notified: number;
}> {
  const now = new Date();
  if (!isWithinWorkingHours(now)) return { notified: 0 };
  if (!process.env.SLACK_BOT_TOKEN) return { notified: 0 };

  const rows = await prisma.rpRequest.findMany({
    where: { urgency: "urgent" },
  });

  let notified = 0;

  for (const row of rows) {
    const rpNum = row.rpNum;
    const status = (row.status ?? "").trim();
    const itemType = row.itemType;
    const entryDate = row.entryDate;

    if (!status && row.urgency === "urgent" && !isExcludedItem(itemType) && entryDate) {
      const elapsed = getWorkingHoursBetween(entryDate, now);
      const escalationHour = await getNextEscalationHour(elapsed, rpNum);
      if (escalationHour) {
        const userIds =
          UNBRIEFED_ESCALATION_USER_IDS[escalationHour] ??
          PRODUCTION_WARNING_USER_IDS;
        const text = [
          `:rotating_light: *Urgent panel not briefed* (${escalationLabel(escalationHour)} - ${escalationHour}h)`,
          `*RP:* ${rpNum}`,
          `*Booth ID:* ${row.boothId ?? ""}`,
          `*Color:* ${row.color ?? ""}`,
          `*Item:* ${itemType ?? ""}`,
          row.notes ? `*Notes:* ${row.notes}` : "",
          `*Working hours elapsed:* ${toSingleDecimal(elapsed)}h`,
          `This urgent part has not been briefed to *${row.reviewGroup ?? "Unknown Factory"}*.`,
        ]
          .filter(Boolean)
          .join("\n");
        await openDmAndPost(userIds, text);
        await setSlackAutomationState(escalationKey(rpNum, escalationHour), "1");
        notified++;
      }
    } else if (status) {
      await clearEscalationMarkers(rpNum);
    }

    if (
      row.urgency === "urgent" &&
      isProductionStatus(status) &&
      !isExcludedItem(itemType) &&
      row.dueDate
    ) {
      const deadlineEnd = getProductionDeadlineEndMoment(row.dueDate);
      if (!deadlineEnd) continue;

      const hoursToDeadline = getWorkingHoursBetween(now, deadlineEnd);
      const warningHours = PRODUCTION_WARNING_WORKING_DAYS * workingDayHours();

      if (hoursToDeadline > 0 && hoursToDeadline <= warningHours) {
        const key = productionApproachingKey(rpNum, row.dueDate);
        if (!(await hasSlackAutomationState(key))) {
          const daysRemaining = toSingleDecimal(
            hoursToDeadline / workingDayHours(),
          );
          const text = [
            ":warning: *Production date approaching* (4 working days)",
            `*RP:* ${rpNum}`,
            `*Booth ID:* ${row.boothId ?? ""}`,
            `*Color:* ${row.color ?? ""}`,
            `*Item:* ${itemType ?? ""}`,
            `*Status:* ${status}`,
            row.notes ? `*Notes:* ${row.notes}` : "",
            `*Working days to production date:* ${daysRemaining}`,
            `Please ensure this urgent panel is aligned with *${row.reviewGroup ?? "Unknown Factory"}*.`,
          ]
            .filter(Boolean)
            .join("\n");
          await openDmAndPost(PRODUCTION_WARNING_USER_IDS, text);
          await setSlackAutomationState(key, "1");
          notified++;
        }
      }

      if (now.getTime() >= deadlineEnd.getTime()) {
        const key = productionDeadlineReachedKey(rpNum, row.dueDate);
        if (!(await hasSlackAutomationState(key))) {
          const overdueHours = getWorkingHoursBetween(deadlineEnd, now);
          const overdueDays = toSingleDecimal(
            overdueHours / workingDayHours(),
          );
          const text = [
            ":bangbang: *Production deadline reached/passed*",
            `*RP:* ${rpNum}`,
            `*Booth ID:* ${row.boothId ?? ""}`,
            `*Color:* ${row.color ?? ""}`,
            `*Item:* ${itemType ?? ""}`,
            `*Status:* ${status}`,
            row.notes ? `*Notes:* ${row.notes}` : "",
            `*Overdue (working days):* ${overdueDays}`,
            `Deadline is reached while still pending with *${row.reviewGroup ?? "Unknown Factory"}*.`,
          ]
            .filter(Boolean)
            .join("\n");
          await openDmAndPost(PRODUCTION_WARNING_USER_IDS, text);
          await setSlackAutomationState(key, "1");
          notified++;
        }
      }
    }
  }

  return { notified };
}
