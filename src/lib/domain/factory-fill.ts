import type { Prisma, RpRequest } from "@prisma/client";

import { shouldRunInWebapp } from "@/lib/domain/automation-settings";
import { enqueueSheetSync } from "@/lib/domain/panel-orders";
import { deduceFactoryFromBatch } from "@/lib/domain/stock-replacement";
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

function isShelfTable(itemType: string | null): boolean {
  return norm(itemType).toUpperCase() === "SHELF / TABLE (S)";
}

/** Port of updateFactoryFillForRow_ + booth batch exception. */
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
  let out = "";
  const code = match[1];
  if (code === "KB") out = "KAZ";
  if (code === "VB") out = "VAR";
  if (code === "AB") out = "AKS";
  if (out === "VAR" && isShelfTable(item)) out = "AKS";
  return out;
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
  const data: { reviewGroup?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (factory && factory !== norm(row.reviewGroup)) {
    data.reviewGroup = factory;
  } else if (!factory && norm(row.reviewGroup) && !row.boothId) {
    data.reviewGroup = "";
  }

  if (data.reviewGroup !== undefined) {
    await prisma.rpRequest.update({ where: { id: rpId }, data });
    await enqueueSheetSync("rp", rpId);
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
    },
  });

  let updated = 0;
  for (const row of rows) {
    const factory = computeFactoryFromRow(row.boothId, row.itemType);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    let changed = false;

    if (!norm(row.reviewGroup) && factory) {
      patch.reviewGroup = factory;
      changed = true;
    }

    if (changed) {
      await prisma.rpRequest.update({
        where: { id: row.id },
        data: patch,
      });
      await enqueueSheetSync("rp", row.id);
      updated++;
    }

    const current = await prisma.rpRequest.findUnique({ where: { id: row.id } });
    if (current && (await applyBriefedRules(current))) updated++;
  }

  return { updated };
}
