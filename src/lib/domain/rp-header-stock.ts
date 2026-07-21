import type { RpRequest } from "@prisma/client";

import type { DbExecutor } from "@/lib/db/executor";
import { isPanelLineItem } from "@/lib/domain/rp-line-items";
import { autoPayerUpdate } from "@/lib/domain/rp-payer";
import { prisma } from "@/lib/prisma";

/** Workshop note written to Rep.Parts26 when all panels are taken from stock. */
export const RP_DO_NOT_PRODUCE_WORKSHOP_NOTE = "Не произвеждай!";

export type StockReplacementSummary = "none" | "partial" | "full";

function isUsaMarket(market: string | null | undefined): boolean {
  const m = (market ?? "").trim().toLowerCase();
  return (
    m === "usa" ||
    m === "united states" ||
    m === "us" ||
    m === "united states of america"
  );
}

export function getUrgentPanelReadyShipMethod(
  market: string | null | undefined,
): string {
  return isUsaMarket(market) ? "Container" : "Pallet";
}

export function summarizePanelStockReplacement(
  panelItems: { fulfillment: string }[],
): StockReplacementSummary {
  if (!panelItems.length) return "none";
  const fromStock = panelItems.filter(
    (item) => item.fulfillment === "from_stock",
  ).length;
  if (fromStock === 0) return "none";
  if (fromStock === panelItems.length) return "full";
  return "partial";
}

/** Statuses that must not be downgraded back to Ready by stock-header recompute. */
function isPastReadyStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return (
    s === "shipped" ||
    s === "cancelled" ||
    s === "ordered on amazon"
  );
}

/**
 * Recompute RP header fields after line-item stock changes.
 * Full stock → route as STOCK + "don't produce". Promote to Ready for logistics
 * only when the RP is not already Shipped/Cancelled (import/backfill must not
 * wipe a later ship).
 */
export async function recomputeRpHeaderAfterStockChange(
  rpId: string,
  executor: DbExecutor = prisma,
): Promise<StockReplacementSummary> {
  const lineItems = await executor.rpLineItem.findMany({
    where: { rpRequestId: rpId },
  });

  const panelItems = lineItems.filter(isPanelLineItem);
  const summary = summarizePanelStockReplacement(panelItems);

  const rp = await executor.rpRequest.findUnique({ where: { id: rpId } });
  if (!rp) throw new Error(`RP ${rpId} not found`);

  const now = new Date();
  const updates: {
    stockReplacementSummary: StockReplacementSummary;
    updatedAt: Date;
    reviewGroup?: string;
    status?: string;
    shipMethod?: string;
    workshopNote?: string | null;
    payer?: string | null;
  } = {
    stockReplacementSummary: summary,
    updatedAt: now,
  };

  if (summary === "full") {
    updates.reviewGroup = "STOCK";
    updates.workshopNote = RP_DO_NOT_PRODUCE_WORKSHOP_NOTE;
    if (!isPastReadyStatus(rp.status)) {
      updates.status = "Ready";
      updates.shipMethod = getUrgentPanelReadyShipMethod(rp.market);
    }
  } else if (summary === "partial") {
    updates.workshopNote = null;
  } else {
    updates.workshopNote =
      rp.workshopNote === RP_DO_NOT_PRODUCE_WORKSHOP_NOTE
        ? null
        : rp.workshopNote;
  }

  const nextReviewGroup =
    updates.reviewGroup !== undefined ? updates.reviewGroup : rp.reviewGroup;
  const payerPatch = autoPayerUpdate({
    issueType: rp.issueType,
    reviewGroup: nextReviewGroup,
    itemType: rp.itemType,
    quantity: rp.quantity,
    partRpCode: rp.partRpCode,
    partDescription: rp.partDescription,
    clarifications: rp.clarifications,
    payer: rp.payer,
    payerManual: rp.payerManual,
  });
  if (payerPatch) updates.payer = payerPatch.payer;

  await executor.rpRequest.update({
    where: { id: rpId },
    data: updates,
  });

  return summary;
}

/** Workshop note to write when syncing RP row to Google Sheets. */
export function resolveWorkshopNoteForSheetSync(row: RpRequest): string {
  if (row.stockReplacementSummary === "full") {
    return RP_DO_NOT_PRODUCE_WORKSHOP_NOTE;
  }
  if (row.workshopNote === RP_DO_NOT_PRODUCE_WORKSHOP_NOTE) {
    return "";
  }
  return row.workshopNote ?? "";
}
