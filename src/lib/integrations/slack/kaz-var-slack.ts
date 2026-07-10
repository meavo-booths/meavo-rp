import {
  collectFactoryPanelsForOrder,
  collectPanelsMissingWorkshopNote,
  markPanelOrderEntriesSent,
  type PanelOrderEntry,
} from "@/lib/domain/panel-order-collect";
import {
  hasSlackAutomationState,
  missingWorkshopNoteWarnKey,
  setSlackAutomationState,
} from "@/lib/integrations/slack/slack-automation-state";
import { openDmAndPost, uploadPdfToUsers } from "@/lib/integrations/slack/slack-client";
import { PANEL_ORDER_DM_RECIPIENTS } from "@/lib/integrations/slack/slack-config";
import { buildPanelOrderPdf } from "@/lib/integrations/slack/panel-order-pdf";
import { isKazPanelBusinessHours } from "@/lib/integrations/slack/slack-working-hours";

function formatMissingWorkshopLine(entry: PanelOrderEntry): string {
  return `• *${entry.rpNum}* (${entry.factory}, ${entry.urgency}, ${entry.status ?? "—"})`;
}

async function notifyMissingWorkshopNote(
  entries: PanelOrderEntry[],
  headline: string,
  markWarned: boolean,
): Promise<number> {
  if (!entries.length) return 0;
  const text = [
    headline,
    ...entries.map(formatMissingWorkshopLine),
    "",
    "Моля, попълнете *Бележка Цех* (колона AD на Rep.Parts26 / колона T на Internal Production).",
  ].join("\n");
  await openDmAndPost([...PANEL_ORDER_DM_RECIPIENTS.workshopNoteWarn], text);
  if (markWarned) {
    for (const entry of entries) {
      await setSlackAutomationState(
        missingWorkshopNoteWarnKey(entry.recordType, entry.rpNum),
        String(Date.now()),
      );
    }
  }
  return entries.length;
}

async function sendPanelPdfBatch(
  factory: "KAZ" | "VAR",
  entries: PanelOrderEntry[],
  fileNamePrefix: string,
  messageLines: string[],
  recipientKind: keyof typeof PANEL_ORDER_DM_RECIPIENTS,
): Promise<number> {
  if (!entries.length) return 0;
  const built = await buildPanelOrderPdf(entries, factory, fileNamePrefix);
  if (!built.ok) {
    console.error("Panel PDF build failed:", built.message);
    return 0;
  }
  const nums = built.exportNums.join(", ");
  const comment = [
    ...messageLines,
    nums ? `Панели: ${nums}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  await uploadPdfToUsers(
    [...PANEL_ORDER_DM_RECIPIENTS[recipientKind]],
    built.pdfBytes,
    built.fileName,
    comment,
  );
  await markPanelOrderEntriesSent(entries);
  return entries.length;
}

async function processUrgentMissingWorkshopWarnings(): Promise<number> {
  const entries = await collectPanelsMissingWorkshopNote("urgent", {
    minAgeMs: 0,
  });
  return notifyMissingWorkshopNote(
    entries,
    "⚠️ *Липсва Бележка Цех* — *Urgent* панели (KAZ / VAR):",
    false,
  );
}

async function processStandardMissingWorkshopWarnings(): Promise<number> {
  const all = await collectPanelsMissingWorkshopNote("standard", {
    minAgeMs: 24 * 60 * 60 * 1000,
  });
  const toNotify: PanelOrderEntry[] = [];
  for (const entry of all) {
    const key = missingWorkshopNoteWarnKey(entry.recordType, entry.rpNum);
    if (!(await hasSlackAutomationState(key))) toNotify.push(entry);
  }
  return notifyMissingWorkshopNote(
    toNotify,
    "⚠️ *Липсва Бележка Цех* — *Standard* панели (въведени преди 1+ ден, KAZ / VAR):",
    true,
  );
}

/** KAZ urgent sweep (every 2h) + standard workshop-note warnings. */
export async function runKazPanelOrderSlack(): Promise<{
  sent: number;
  warnings: number;
}> {
  if (!process.env.SLACK_BOT_TOKEN) return { sent: 0, warnings: 0 };
  if (!isKazPanelBusinessHours()) return { sent: 0, warnings: 0 };

  const now = new Date();
  const isMondayMorning =
    now.getDay() === 1 && now.getHours() >= 9 && now.getHours() < 10;

  let weeklySent = 0;
  if (isMondayMorning) {
    try {
      const weekly = await runKazWeeklyStandardPanelSlack();
      weeklySent = weekly.sent;
    } catch (error) {
      console.error("KAZ weekly standard panel Slack failed:", error);
    }
  }

  let warnings = 0;
  try {
    warnings = await processUrgentMissingWorkshopWarnings();
  } catch (error) {
    console.error("KAZ urgent workshop-note warning failed:", error);
  }

  try {
    warnings += await processStandardMissingWorkshopWarnings();
  } catch (error) {
    console.error("KAZ standard workshop-note warning failed:", error);
  }

  const entries = await collectFactoryPanelsForOrder("KAZ", "urgent");
  let sent = 0;
  for (const entry of entries) {
    try {
      sent += await sendPanelPdfBatch(
        "KAZ",
        [entry],
        `KAZ-Urgent-${entry.rpNum.replace(/[^\w-]+/g, "")}`,
        ["Резервни Части KAZ — *Urgent*", `Панел: *${entry.rpNum}*`],
        "urgent",
      );
    } catch (error) {
      console.error(`KAZ urgent PDF failed for ${entry.rpNum}:`, error);
    }
  }

  return { sent: sent + weeklySent, warnings };
}

/** VAR weekly batch (Monday 09:00). */
export async function runVarPanelOrderSlack(): Promise<{ sent: number }> {
  if (!process.env.SLACK_BOT_TOKEN) return { sent: 0 };
  if (!isKazPanelBusinessHours()) return { sent: 0 };

  const entries = await collectFactoryPanelsForOrder("VAR", "all");
  const sent = await sendPanelPdfBatch(
    "VAR",
    entries,
    "VAR-Panels",
    ["Резервни Части VAR — *Standard* (седмична поръчка)"],
    "standard",
  );
  return { sent };
}

/** KAZ weekly standard batch — invoked from same cron on Mondays if needed. */
export async function runKazWeeklyStandardPanelSlack(): Promise<{ sent: number }> {
  if (!process.env.SLACK_BOT_TOKEN) return { sent: 0 };
  if (!isKazPanelBusinessHours()) return { sent: 0 };

  const entries = await collectFactoryPanelsForOrder("KAZ", "standard");
  const sent = await sendPanelPdfBatch(
    "KAZ",
    entries,
    "KAZ-Standard-Panels",
    ["Резервни Части KAZ — *Standard* (седмична поръчка)"],
    "standard",
  );
  return { sent };
}
