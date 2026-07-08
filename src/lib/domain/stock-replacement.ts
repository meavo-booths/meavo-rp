import { mintNextIpNum } from "@/lib/domain/ip-numbers";
import { enqueueSheetSync } from "@/lib/domain/panel-orders";
import { recomputeRpHeaderAfterStockChange } from "@/lib/domain/rp-header-stock";
import { isPanelLineItem } from "@/lib/domain/rp-line-items";
import { computeShippingDeadlineFromUrgency } from "@/lib/domain/working-days";
import { prisma } from "@/lib/prisma";

export const VALID_STOCK_WAREHOUSES = new Set([
  "Topoli",
  "Alliance",
  "NY Warehouse",
  "SF Warehouse",
]);

export const STOCK_REPLACEMENT_REASON = "Stock Replacement (RP)";

export type StockPanelDetails = {
  batch: string;
  color: string;
  warehouse: string;
};

export type MarkPanelsFromStockInput = {
  rpId: string;
  lineItemIds: string[];
  stockDetails: StockPanelDetails | StockPanelDetails[];
  actorEmail: string;
};

export type MarkPanelsFromStockResult = {
  rpId: string;
  createdIpNums: string[];
  lineItemIds: string[];
};

function normalizeCell(value: string): string {
  return value.trim();
}

/** Port of deduceFactoryFromBatch_ in legacy WebAppLogic.js. */
export function deduceFactoryFromBatch(batch: string): string {
  const batchUpper = normalizeCell(batch).toUpperCase();
  if (!batchUpper) return "";
  const match = batchUpper.match(/([A-Z]{2})(\d{2,3})/);
  if (!match) return "";
  const code = match[1];
  if (code === "KB") return "KAZ";
  if (code === "VB") return "VAR";
  if (code === "AB") return "AKS";
  return "";
}

function resolveStockDetails(
  lineItemIds: string[],
  stockDetails: StockPanelDetails | StockPanelDetails[],
): StockPanelDetails[] {
  if (Array.isArray(stockDetails)) {
    if (stockDetails.length !== lineItemIds.length) {
      throw new Error(
        "Per-panel stock details must match the number of selected panels",
      );
    }
    return stockDetails;
  }
  return lineItemIds.map(() => stockDetails);
}

function validateStockDetails(details: StockPanelDetails): void {
  if (!normalizeCell(details.batch)) {
    throw new Error("Batch is required");
  }
  if (!normalizeCell(details.color)) {
    throw new Error("Colour is required");
  }
  const warehouse = normalizeCell(details.warehouse);
  if (!warehouse || !VALID_STOCK_WAREHOUSES.has(warehouse)) {
    throw new Error("Warehouse is required");
  }
}

/**
 * Mark selected panel line items as taken from stock and create one IP per panel.
 * Single transaction; enqueues sheet sync for RP and each new IP.
 */
export async function markPanelsFromStock(
  input: MarkPanelsFromStockInput,
): Promise<MarkPanelsFromStockResult> {
  const { rpId, lineItemIds, actorEmail } = input;
  if (!lineItemIds.length) {
    throw new Error("At least one panel line item must be selected");
  }

  const detailsList = resolveStockDetails(lineItemIds, input.stockDetails);
  for (const details of detailsList) {
    validateStockDetails(details);
  }

  const uniqueIds = [...new Set(lineItemIds)];
  if (uniqueIds.length !== lineItemIds.length) {
    throw new Error("Duplicate line item IDs are not allowed");
  }

  return prisma.$transaction(async (tx) => {
    const rp = await tx.rpRequest.findUnique({ where: { id: rpId } });
    if (!rp) throw new Error("RP not found");

    const lineItems = await tx.rpLineItem.findMany({
      where: {
        rpRequestId: rpId,
        id: { in: uniqueIds },
      },
    });

    if (lineItems.length !== uniqueIds.length) {
      throw new Error("One or more line items were not found on this RP");
    }

    for (const item of lineItems) {
      if (!isPanelLineItem(item)) {
        throw new Error("Only panel line items can be taken from stock");
      }
      if (item.fulfillment !== "pending") {
        throw new Error(
          `Line item ${item.lineIndex + 1} is already ${item.fulfillment}`,
        );
      }
    }

    const createdIpNums: string[] = [];
    const now = new Date();

    for (let i = 0; i < lineItems.length; i++) {
      const lineItem = lineItems[i];
      const details = detailsList[i];
      const batch = normalizeCell(details.batch);
      const color = normalizeCell(details.color);
      const warehouse = normalizeCell(details.warehouse);
      const factory = deduceFactoryFromBatch(batch);
      const ipNum = await mintNextIpNum(tx);
      const entryDate = now;
      const deadline = computeShippingDeadlineFromUrgency("standard", entryDate);

      const ipRow = await tx.rpInternalProductionRow.create({
        data: {
          ipNum,
          entryDate,
          deadline,
          ownerEmail: normalizeCell(actorEmail),
          reason: STOCK_REPLACEMENT_REASON,
          urgency: "standard",
          model: rp.model,
          batch,
          colour: color,
          panel: lineItem.panelName ?? "",
          panelClarification: "",
          notes: `Stock Replacement for ${rp.rpNum}`,
          warehouse,
          factory: factory || null,
          status: "Briefed",
          tracking: "",
          payer: "",
          sourceRpId: rp.id,
          sourceLineItemId: lineItem.id,
          sourceRpNum: rp.rpNum,
          updatedAt: now,
        },
        select: { id: true },
      });

      await tx.rpLineItem.update({
        where: { id: lineItem.id },
        data: {
          fulfillment: "from_stock",
          takenFromStockAt: now,
          takenFromStockBy: normalizeCell(actorEmail),
          stockReplacementIpId: ipRow.id,
          updatedAt: now,
        },
      });

      createdIpNums.push(ipNum);
      await enqueueSheetSync("ip", ipRow.id, "upsert", tx);
    }

    await recomputeRpHeaderAfterStockChange(rpId, tx);
    await enqueueSheetSync("rp", rpId, "upsert", tx);

    return {
      rpId,
      createdIpNums,
      lineItemIds: uniqueIds,
    };
  });
}
