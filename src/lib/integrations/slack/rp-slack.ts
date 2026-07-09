import { prisma } from "@/lib/prisma";

const SLACK_API = "https://slack.com/api/chat.postMessage";

async function postSlackMessage(channel: string, text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;

  const res = await fetch(SLACK_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });
  if (!res.ok) {
    console.error("Slack API HTTP error", res.status);
  }
}

async function getAutomationState(key: string): Promise<string | null> {
  const row = await prisma.rpAutomationState.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setAutomationState(key: string, value: string): Promise<void> {
  await prisma.rpAutomationState.upsert({
    where: { key },
    create: { key, value },
    update: { value, updatedAt: new Date() },
  });
}

/** Unbriefed urgent panels — port of UnbriefedUrgentPanelSlackBot.js (core sweep). */
export async function runUnbriefedUrgentPanelsCheck(): Promise<{
  notified: number;
}> {
  const channel = process.env.SLACK_URGENT_CHANNEL ?? "";
  if (!channel) return { notified: 0 };

  const rows = await prisma.rpRequest.findMany({
    where: {
      urgency: "urgent",
      status: { in: ["", "Briefed"] },
    },
    take: 50,
  });

  let notified = 0;
  for (const row of rows) {
    const dedupeKey = `unbriefed:${row.rpNum}`;
    if (await getAutomationState(dedupeKey)) continue;
    const item = (row.itemType ?? "").toUpperCase();
    if (item.includes("PART") || item.includes("STOCK")) continue;

    await postSlackMessage(
      channel,
      `*Unbriefed urgent panel* ${row.rpNum} — ${row.itemType} (${row.market})`,
    );
    await setAutomationState(dedupeKey, new Date().toISOString());
    notified++;
  }
  return { notified };
}

/** KAZ panel orders — port of KazPanelOrderSlackAutomation.js (pending workshop note). */
export async function runKazPanelOrderSlack(): Promise<{ notified: number }> {
  const channel = process.env.SLACK_KAZ_PANEL_CHANNEL ?? "";
  if (!channel) return { notified: 0 };

  const rows = await prisma.rpRequest.findMany({
    where: {
      reviewGroup: { contains: "KAZ", mode: "insensitive" },
      status: { in: ["Briefed", "In Production", "Ready"] },
      workshopNote: { not: null },
      orderSentAt: null,
    },
    take: 20,
  });

  let notified = 0;
  for (const row of rows) {
    const dedupeKey = `kaz-panel:${row.rpNum}`;
    if (await getAutomationState(dedupeKey)) continue;
    await postSlackMessage(
      channel,
      `KAZ panel order ready: *${row.rpNum}* — ${row.itemType}`,
    );
    await setAutomationState(dedupeKey, new Date().toISOString());
    notified++;
  }
  return { notified };
}

/** VAR panel orders — port of VarPanelOrderSlackAutomation.js */
export async function runVarPanelOrderSlack(): Promise<{ notified: number }> {
  const channel = process.env.SLACK_VAR_PANEL_CHANNEL ?? "";
  if (!channel) return { notified: 0 };

  const rows = await prisma.rpRequest.findMany({
    where: {
      reviewGroup: { contains: "VAR", mode: "insensitive" },
      status: { in: ["Briefed", "In Production", "Ready"] },
      workshopNote: { not: null },
      orderSentAt: null,
    },
    take: 20,
  });

  let notified = 0;
  for (const row of rows) {
    const dedupeKey = `var-panel:${row.rpNum}`;
    if (await getAutomationState(dedupeKey)) continue;
    await postSlackMessage(
      channel,
      `VAR panel order ready: *${row.rpNum}* — ${row.itemType}`,
    );
    await setAutomationState(dedupeKey, new Date().toISOString());
    notified++;
  }
  return { notified };
}

/** RP Slack sweep — delayed factory DMs (simplified). */
export async function runRpSlackSweep(): Promise<{ notified: number }> {
  const channel = process.env.SLACK_RP_CHANNEL ?? "";
  if (!channel) return { notified: 0 };

  const rows = await prisma.rpRequest.findMany({
    where: {
      urgency: "urgent",
      status: "Delayed",
    },
    take: 20,
  });

  let notified = 0;
  for (const row of rows) {
    const dedupeKey = `rp-delayed:${row.rpNum}`;
    if (await getAutomationState(dedupeKey)) continue;
    await postSlackMessage(
      channel,
      `Delayed urgent RP: *${row.rpNum}*`,
    );
    await setAutomationState(dedupeKey, new Date().toISOString());
    notified++;
  }
  return { notified };
}
