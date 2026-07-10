import { createHash } from "crypto";

import type { RpInternalProductionRow, RpRequest } from "@prisma/client";

import { shouldRunInWebapp } from "@/lib/domain/automation-settings";
import { prisma } from "@/lib/prisma";

import {
  factoryDeadlineSentKey,
  getSlackAutomationState,
  hasSlackAutomationState,
  setSlackAutomationState,
} from "@/lib/integrations/slack/slack-automation-state";
import { openDmAndPost, postChannelMessage } from "@/lib/integrations/slack/slack-client";
import {
  FACTORY_ALIASES,
  FACTORY_DEADLINE_EXCLUDED_STATUSES,
  FACTORY_DEADLINE_RULES,
  PART_ITEM_VALUES,
  RP_SLACK_CONFIG,
} from "@/lib/integrations/slack/slack-config";
import { getWorkingHoursBetween } from "@/lib/integrations/slack/slack-working-hours";

export type RpSlackMutationEvent =
  | "created"
  | "status_changed"
  | "ready_marked"
  | "ready_reverted"
  | "factory_assigned";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function hashMessage(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function isPartItem(itemType: string | null): boolean {
  return PART_ITEM_VALUES.has(norm(itemType).toUpperCase());
}

function normalizeFactory(factory: string | null): string {
  const raw = norm(factory).toUpperCase();
  return FACTORY_ALIASES[raw] ?? raw;
}

function buildUrgentSlackMessage(row: RpRequest, status: string): string {
  const lines = [
    `:rotating_light: *Urgent ${isPartItem(row.itemType) ? "part" : "panel"}*`,
    `*RP:* ${row.rpNum}`,
    `*Status:* ${status || "—"}`,
    `*Item:* ${row.itemType ?? ""}`,
    `*Factory:* ${row.reviewGroup ?? "—"}`,
    `*Client:* ${row.client ?? ""}`,
    `*Ship method:* ${row.shipMethod ?? ""}`,
  ];
  if (row.tracking) lines.push(`*Tracking:* ${row.tracking}`);
  return lines.join("\n");
}

function nikolayDmKey(kind: string, num: string): string {
  return `NIKOLAY_AKS_DM_${kind}_${norm(num)}`;
}

function palletReadyKey(rpNum: string): string {
  return `UPS_PALLET_READY_${norm(rpNum)}`;
}

function urgentFactoryInstantKey(rpNum: string): string {
  return `UPS_FACTORY_INSTANT_${norm(rpNum)}`;
}

function urgentFactoryDelayedKey(rpNum: string): string {
  return `UPS_FACTORY_DELAYED_${norm(rpNum)}`;
}

function isNikolayAksPanelRp(row: RpRequest): boolean {
  const group = norm(row.reviewGroup).toUpperCase();
  if (!group.includes("AKS")) return false;
  return !isPartItem(row.itemType);
}

function isNikolayAksPanelIp(row: RpInternalProductionRow): boolean {
  const factory = norm(row.factory).toUpperCase();
  if (!factory.includes("AKS")) return false;
  return !isPartItem(row.panel);
}

async function maybeNotifyNikolayAksRp(row: RpRequest): Promise<void> {
  if (!isNikolayAksPanelRp(row)) return;
  const key = nikolayDmKey("RP", row.rpNum);
  if (await hasSlackAutomationState(key)) return;
  const text = [
    ":new: *New AKS panel (RP)*",
    `*RP:* ${row.rpNum}`,
    `*Urgency:* ${row.urgency}`,
    `*Panel:* ${row.itemType ?? ""}`,
    row.model ? `*Model:* ${row.model}` : "",
    row.boothId ? `*Booth:* ${row.boothId}` : "",
    row.color ? `*Colour:* ${row.color}` : "",
    `*Status:* ${row.status ?? "—"}`,
  ]
    .filter(Boolean)
    .join("\n");
  await openDmAndPost([RP_SLACK_CONFIG.nikolayAksDmUserId], text);
  await setSlackAutomationState(key, "1");
}

export async function maybeNotifyNikolayAksIp(
  row: RpInternalProductionRow,
): Promise<void> {
  if (!isNikolayAksPanelIp(row)) return;
  const key = nikolayDmKey("IP", row.ipNum);
  if (await hasSlackAutomationState(key)) return;
  const text = [
    ":new: *New AKS panel (IP)*",
    `*IP:* ${row.ipNum}`,
    `*Source RP:* ${row.sourceRpNum ?? "—"}`,
    `*Panel:* ${row.panel ?? ""}`,
    `*Factory:* ${row.factory ?? ""}`,
    `*Status:* ${row.status ?? "—"}`,
  ].join("\n");
  await openDmAndPost([RP_SLACK_CONFIG.nikolayAksDmUserId], text);
  await setSlackAutomationState(key, "1");
}

async function maybeNotifyUrgentFactoryInstant(row: RpRequest): Promise<void> {
  if (row.urgency !== "urgent" || !isPartItem(row.itemType)) return;
  if (norm(row.reviewGroup)) return;
  const key = urgentFactoryInstantKey(row.rpNum);
  if (await hasSlackAutomationState(key)) return;
  const text = [
    ":warning: *Urgent part needs factory assignment*",
    `*RP:* ${row.rpNum}`,
    `*Item:* ${row.itemType ?? ""}`,
    "Column V (factory) is empty.",
  ].join("\n");
  await openDmAndPost(
    [RP_SLACK_CONFIG.urgentPartFactoryInstantUserId],
    text,
  );
  await setSlackAutomationState(key, "1");
}

async function maybeNotifyUrgentChannel(row: RpRequest): Promise<void> {
  if (row.urgency !== "urgent") return;
  const status = norm(row.status);
  const message = buildUrgentSlackMessage(row, status);
  const hashKey = `UPS_HASH_${row.rpNum}`;
  const newHash = hashMessage(message);
  const oldHash = await getSlackAutomationState(hashKey);
  if (oldHash === newHash) return;
  await postChannelMessage(RP_SLACK_CONFIG.channelId, message);
  await setSlackAutomationState(hashKey, newHash);
}

async function maybeNotifyPalletReady(row: RpRequest): Promise<void> {
  const status = norm(row.status).toUpperCase();
  const method = norm(row.shipMethod).toLowerCase();
  if (status !== "READY") return;
  if (method !== "pallet" && method !== "container") return;
  const key = palletReadyKey(row.rpNum);
  if (await hasSlackAutomationState(key)) return;
  const text = [
    ":package: *Ready for logistics*",
    `*RP:* ${row.rpNum}`,
    `*Method:* ${row.shipMethod}`,
    `*Address:* ${row.address ?? "—"}`,
    `*Client:* ${row.client ?? ""}`,
    "Assign pallet/container + address.",
  ].join("\n");
  await postChannelMessage(RP_SLACK_CONFIG.logisticsChannelId, text);
  await setSlackAutomationState(key, "1");
}

export async function notifyShippingNoLongerReady(
  row: RpRequest,
  newStatus: string,
): Promise<void> {
  await prisma.rpAutomationState.deleteMany({
    where: { key: palletReadyKey(row.rpNum) },
  });
  const text = [
    ":arrow_backward: *No longer Ready*",
    `*RP:* ${row.rpNum}`,
    `*New status:* ${newStatus || "—"}`,
  ].join("\n");
  await postChannelMessage(RP_SLACK_CONFIG.channelId, text);
}

export async function notifyAfterRpMutation(
  rpNum: string,
  event: RpSlackMutationEvent,
): Promise<void> {
  if (!(await shouldRunInWebapp("rp_slack"))) return;
  if (!process.env.SLACK_BOT_TOKEN) return;

  const row = await prisma.rpRequest.findUnique({ where: { rpNum } });
  if (!row) return;

  try {
    if (event === "created") {
      await maybeNotifyNikolayAksRp(row);
      await maybeNotifyUrgentFactoryInstant(row);
    }
    if (event === "status_changed" || event === "created") {
      await maybeNotifyUrgentChannel(row);
    }
    if (event === "ready_marked") {
      await maybeNotifyPalletReady(row);
      await maybeNotifyUrgentChannel(row);
    }
    if (event === "ready_reverted") {
      await notifyShippingNoLongerReady(row, row.status ?? "");
      await maybeNotifyUrgentChannel(row);
    }
    if (event === "factory_assigned") {
      await maybeNotifyUrgentChannel(row);
    }
  } catch (error) {
    console.error(`RP Slack hook failed for ${rpNum}:`, error);
  }
}

export async function runRpSlackSweep(): Promise<{
  delayedFactoryDms: number;
  digests: number;
}> {
  if (!process.env.SLACK_BOT_TOKEN) {
    return { delayedFactoryDms: 0, digests: 0 };
  }

  const now = new Date();
  let delayedFactoryDms = 0;

  const missingFactory = await prisma.rpRequest.findMany({
    where: {
      urgency: "urgent",
      OR: [{ reviewGroup: null }, { reviewGroup: "" }],
    },
  });

  for (const row of missingFactory) {
    if (!isPartItem(row.itemType) || !row.entryDate) continue;
    const hours = getWorkingHoursBetween(
      row.entryDate,
      now,
    );
    if (hours < RP_SLACK_CONFIG.urgentPartFactoryDelayedAfterHours) continue;
    const key = urgentFactoryDelayedKey(row.rpNum);
    if (await hasSlackAutomationState(key)) continue;
    const text = [
      ":hourglass: *Urgent part still missing factory (>1h)*",
      `*RP:* ${row.rpNum}`,
      `*Item:* ${row.itemType ?? ""}`,
    ].join("\n");
    await openDmAndPost(
      [RP_SLACK_CONFIG.urgentPartFactoryDelayedUserId],
      text,
    );
    await setSlackAutomationState(key, "1");
    delayedFactoryDms++;
  }

  const hour = now.getHours();
  let digests = 0;
  if (
    hour === RP_SLACK_CONFIG.dailyMissingFactoryDigestHour ||
    hour === RP_SLACK_CONFIG.dailyMissingFactoryReminderHour
  ) {
    const parts = missingFactory.filter((r) => isPartItem(r.itemType));
    if (parts.length) {
      const isReminder =
        hour === RP_SLACK_CONFIG.dailyMissingFactoryReminderHour;
      const digestKey = `UPS_FACTORY_DIGEST_${now.toISOString().slice(0, 10)}_${hour}`;
      if (!(await hasSlackAutomationState(digestKey))) {
        const text = [
          isReminder
            ? ":bell: *Reminder: urgent parts still missing factory*"
            : ":clipboard: *End-of-day: urgent parts missing factory*",
          ...parts.map((p) => `• *${p.rpNum}* — ${p.itemType ?? ""}`),
        ].join("\n");
        await openDmAndPost(
          [
            RP_SLACK_CONFIG.urgentPartFactoryInstantUserId,
            RP_SLACK_CONFIG.urgentPartFactoryDelayedUserId,
          ],
          text,
        );
        await setSlackAutomationState(digestKey, "1");
        digests++;
      }
    }
  }

  return { delayedFactoryDms, digests };
}

type DeadlineRule = (typeof FACTORY_DEADLINE_RULES)[keyof typeof FACTORY_DEADLINE_RULES][number];

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function matchesItemFilter(
  rule: DeadlineRule,
  itemType: string | null,
): boolean {
  if (rule.itemFilter === "all") return true;
  return !isPartItem(itemType);
}

async function shouldSendFactoryDeadline(
  rule: DeadlineRule,
  row: RpRequest,
  today: Date,
): Promise<{ send: boolean; dateKey: string; message: string }> {
  if (!row.dueDate) return { send: false, dateKey: "", message: "" };
  if (!matchesItemFilter(rule, row.itemType)) {
    return { send: false, dateKey: "", message: "" };
  }

  const deadline = row.dueDate;
  const daysUntil = daysBetween(today, deadline);
  const daysOverdue = daysBetween(deadline, today);
  const factory = normalizeFactory(row.reviewGroup);
  const rpNum = row.rpNum;
  const dateKey = today.toISOString().slice(0, 10);

  if ("daysBefore" in rule && rule.daysBefore != null) {
    if (daysUntil <= rule.daysBefore && daysUntil >= 0) {
      const key = factoryDeadlineSentKey(factory, rule.id, rpNum, dateKey);
      if (await hasSlackAutomationState(key)) {
        return { send: false, dateKey: "", message: "" };
      }
      const locale = rule.messageLocale === "bg" ? "bg" : "en";
      const msg =
        locale === "bg"
          ? `⏰ *Срок за ${factory}* — ${rpNum} (остават ${daysUntil} дни)`
          : `⏰ *${factory} deadline approaching* — ${rpNum} (${daysUntil} days left)`;
      return { send: true, dateKey: key, message: msg };
    }
    if (rule.repeatAfterDeadline && daysOverdue > 0) {
      const repeat = rule.repeatDaysAfterDeadline ?? 1;
      if (daysOverdue % repeat === 0) {
        const key = factoryDeadlineSentKey(
          factory,
          rule.id,
          rpNum,
          `overdue_${daysOverdue}`,
        );
        if (await hasSlackAutomationState(key)) {
          return { send: false, dateKey: "", message: "" };
        }
        const msg = `🔴 *${factory} overdue* — ${rpNum} (${daysOverdue} days past deadline)`;
        return { send: true, dateKey: key, message: msg };
      }
    }
    return { send: false, dateKey: "", message: "" };
  }

  if (!("startDaysOverdue" in rule)) {
    return { send: false, dateKey: "", message: "" };
  }

  const startOverdue = rule.startDaysOverdue ?? 1;
  const repeatDays = rule.repeatDays ?? 2;
  if (daysOverdue < startOverdue) {
    return { send: false, dateKey: "", message: "" };
  }
  const offset = daysOverdue - startOverdue;
  if (offset % repeatDays !== 0) {
    return { send: false, dateKey: "", message: "" };
  }
  const key = factoryDeadlineSentKey(
    factory,
    rule.id,
    rpNum,
    `legacy_${daysOverdue}`,
  );
  if (await hasSlackAutomationState(key)) {
    return { send: false, dateKey: "", message: "" };
  }
  const msg = `🔴 *${factory} deadline overdue* — ${rpNum} (${daysOverdue} days)`;
  return { send: true, dateKey: key, message: msg };
}

export async function runFactoryDeadlineSlackSweep(): Promise<{
  notified: number;
}> {
  if (!process.env.SLACK_BOT_TOKEN) return { notified: 0 };

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let notified = 0;

  const rows = await prisma.rpRequest.findMany({
    where: { dueDate: { not: null } },
  });

  for (const row of rows) {
    const status = norm(row.status).toUpperCase();
    if (FACTORY_DEADLINE_EXCLUDED_STATUSES.has(status)) continue;
    const factory = normalizeFactory(row.reviewGroup);
    const rules =
      FACTORY_DEADLINE_RULES[
        factory as keyof typeof FACTORY_DEADLINE_RULES
      ] ?? [];
    for (const rule of rules) {
      const result = await shouldSendFactoryDeadline(rule, row, today);
      if (!result.send) continue;
      await openDmAndPost([...rule.userIds], result.message);
      await setSlackAutomationState(result.dateKey, "1");
      notified++;
    }
  }

  return { notified };
}
