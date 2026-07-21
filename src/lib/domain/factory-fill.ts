import type { Prisma, RpRequest } from "@prisma/client";

import { shouldRunInWebapp } from "@/lib/domain/automation-settings";
import { recordLifecycleEvent } from "@/lib/domain/lifecycle-events";
import { enqueueSheetSync } from "@/lib/domain/panel-orders";
import { autoPayerUpdate } from "@/lib/domain/rp-payer";
import { notifyAfterRpMutation } from "@/lib/integrations/slack/rp-slack-bot";
import { computeStandardPanelDeadline } from "@/lib/domain/working-days";
import { prisma } from "@/lib/prisma";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isPartLine(itemType: string | null): boolean {
  const k = norm(itemType).toUpperCase();
  return k === "PARTS" || k === "STOCK" || k === "PART";
}

function isKnownFactory(factory: string): boolean {
  const f = factory.toUpperCase();
  return f === "AKS" || f === "KAZ" || f === "VAR";
}

/** Port of updateFactoryFillForRow_ — factory from trailing booth batch code. */
export function computeFactoryFromRow(
  boothId: string | null,
  itemType: string | null,
): string {
  const booth = norm(boothId);
  const item = norm(itemType);
  if (!booth || !item) return "";
  if (isPartLine(item)) return "";

  const match = booth.toUpperCase().match(/([A-Z]{2})(\d{2,3})\s*$/);
  if (!match) return "";
  const code = match[1];
  if (code === "KB") return "KAZ";
  if (code === "VB") return "VAR";
  if (code === "AB") return "AKS";
  return "";
}

function isAtLeastOneCalendarDayAfterEntry(entryDate: Date): boolean {
  const entryDay = entryDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return today > entryDay;
}

function getStandardPanelTargetStatus(
  entryDate: Date | null,
  currentStatus: string,
): string | null {
  const statusLower = norm(currentStatus).toLowerCase();
  if (statusLower && statusLower !== "briefed") return null;
  if (!entryDate) return statusLower ? null : "Briefed";
  if (isAtLeastOneCalendarDayAfterEntry(entryDate)) return "In Production";
  if (!statusLower) return "Briefed";
  return null;
}

async function applyBriefedRules(row: RpRequest): Promise<boolean> {
  const factory = norm(row.reviewGroup);
  if (!factory) return false;

  const status = norm(row.status);
  const itemType = row.itemType;
  const urgency = row.urgency;
  const updates: Prisma.RpRequestUpdateInput = {};

  if (isPartLine(itemType)) {
    if (!status) updates.status = "Briefed";
  } else if (
    isKnownFactory(factory) &&
    !isPartLine(itemType) &&
    urgency === "standard"
  ) {
    if (!row.dueDate && row.entryDate) {
      updates.dueDate = computeStandardPanelDeadline(row.entryDate);
    }
    const nextStatus = getStandardPanelTargetStatus(row.entryDate, status);
    if (nextStatus) updates.status = nextStatus;
  } else if (!status && norm(itemType).toUpperCase().includes("PANEL")) {
    updates.status = "Briefed";
  }

  if (!Object.keys(updates).length) return false;
  await prisma.rpRequest.update({
    where: { id: row.id },
    data: { ...updates, updatedAt: new Date() },
  });
  if (typeof updates.status === "string") {
    await recordLifecycleEvent({
      entityType: "rp",
      entityId: row.id,
      eventType: "status_changed",
      fromStatus: row.status,
      toStatus: updates.status,
      actorEmail: null,
      payload: { source: "factory_fill" },
    });
  }
  await enqueueSheetSync("rp", row.id);
  return true;
}

export async function recalculateFactoryFillForRpId(
  rpId: string,
): Promise<void> {
  if (!(await shouldRunInWebapp("factory_fill"))) return;
  const row = await prisma.rpRequest.findUnique({ where: { id: rpId } });
  if (!row) return;

  const factory = computeFactoryFromRow(row.boothId, row.itemType);
  const data: {
    reviewGroup?: string;
    payer?: string | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };
  if (factory && factory !== norm(row.reviewGroup)) {
    data.reviewGroup = factory;
  } else if (!factory && norm(row.reviewGroup) && !row.boothId) {
    data.reviewGroup = "";
  }

  const nextReviewGroup =
    data.reviewGroup !== undefined ? data.reviewGroup : row.reviewGroup;
  const payerPatch = autoPayerUpdate({
    issueType: row.issueType,
    reviewGroup: nextReviewGroup,
    itemType: row.itemType,
    quantity: row.quantity,
    partRpCode: row.partRpCode,
    partDescription: row.partDescription,
    clarifications: row.clarifications,
    payer: row.payer,
    payerManual: row.payerManual,
  });
  if (payerPatch) data.payer = payerPatch.payer;

  if (data.reviewGroup !== undefined || payerPatch) {
    const hadFactory = norm(row.reviewGroup);
    await prisma.rpRequest.update({ where: { id: rpId }, data });
    await enqueueSheetSync("rp", rpId);
    if (
      data.reviewGroup !== undefined &&
      factory &&
      factory !== hadFactory
    ) {
      void notifyAfterRpMutation(row.rpNum, "factory_assigned");
    }
  }

  const refreshed = await prisma.rpRequest.findUnique({ where: { id: rpId } });
  if (refreshed) await applyBriefedRules(refreshed);
}

/** Daily sweep: fill missing factory + Briefed / In Production rules. */
export async function runFactoryFillSweep(): Promise<{ updated: number }> {
  const rows = await prisma.rpRequest.findMany({
    select: {
      id: true,
      boothId: true,
      itemType: true,
      reviewGroup: true,
      status: true,
      urgency: true,
      entryDate: true,
      dueDate: true,
      issueType: true,
      quantity: true,
      partRpCode: true,
      partDescription: true,
      clarifications: true,
      payer: true,
      payerManual: true,
      rpNum: true,
    },
  });

  let updated = 0;
  for (const row of rows) {
    const factory = computeFactoryFromRow(row.boothId, row.itemType);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    let changed = false;
    let factoryAssigned = false;

    if (!norm(row.reviewGroup) && factory) {
      patch.reviewGroup = factory;
      changed = true;
      factoryAssigned = true;
    }

    const nextReviewGroup =
      typeof patch.reviewGroup === "string" ? patch.reviewGroup : row.reviewGroup;
    const payerPatch = autoPayerUpdate({
      issueType: row.issueType,
      reviewGroup: nextReviewGroup,
      itemType: row.itemType,
      quantity: row.quantity,
      partRpCode: row.partRpCode,
      partDescription: row.partDescription,
      clarifications: row.clarifications,
      payer: row.payer,
      payerManual: row.payerManual,
    });
    if (payerPatch) {
      patch.payer = payerPatch.payer;
      changed = true;
    }

    if (changed) {
      await prisma.rpRequest.update({
        where: { id: row.id },
        data: patch,
      });
      await enqueueSheetSync("rp", row.id);
      if (factoryAssigned && factory) {
        void notifyAfterRpMutation(row.rpNum, "factory_assigned");
      }
      updated++;
    }

    const current = await prisma.rpRequest.findUnique({ where: { id: row.id } });
    if (current && (await applyBriefedRules(current))) updated++;
  }

  return { updated };
}
