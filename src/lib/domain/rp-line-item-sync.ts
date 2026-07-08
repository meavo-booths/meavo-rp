import type { RpRequest } from "@prisma/client";

import type { DbExecutor } from "@/lib/db/executor";
import { recomputeRpHeaderAfterStockChange } from "@/lib/domain/rp-header-stock";
import {
  isPanelLineItem,
  parseRpLineItemsFromRow,
} from "@/lib/domain/rp-line-items";
import { prisma } from "@/lib/prisma";

type RpRow = RpRequest;

/** Replace line items for an RP from its flat column values. */
export async function upsertRpLineItemsFromRow(
  rpRequestId: string,
  row: RpRow,
  executor: DbExecutor = prisma,
): Promise<string[]> {
  const parsed = parseRpLineItemsFromRow(row);

  await executor.rpLineItem.deleteMany({ where: { rpRequestId } });

  if (!parsed.length) return [];

  const inserted = await executor.rpLineItem.createManyAndReturn({
    data: parsed.map((item) => ({
      rpRequestId,
      lineIndex: item.lineIndex,
      kind: item.kind,
      panelName: item.panelName,
      quantity: item.quantity,
      partRpCode: item.partRpCode,
      partDescription: item.partDescription,
      clarifications: item.clarifications,
      fulfillment: "pending" as const,
    })),
    select: { id: true },
  });

  return inserted.map((row) => row.id);
}

const STOCK_REPLACEMENT_REASON_MARKERS = [
  "stock replacement (rp)",
  "stock replacement",
];

function isStockReplacementIp(reason: string | null | undefined): boolean {
  const normalized = (reason ?? "").trim().toLowerCase();
  return STOCK_REPLACEMENT_REASON_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}

function normalizeRpNum(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  const match = raw.match(/RP-(\d+)/i);
  if (match) return `RP-${Number(match[1])}`;
  if (/^\d+$/.test(raw)) return `RP-${Number(raw)}`;
  return raw;
}

/**
 * Backfill source_rp_id / source_line_item_id and line-item stock state from imported IPs.
 */
export async function backfillStockReplacementLinks(
  executor: DbExecutor = prisma,
): Promise<{ linked: number; ambiguous: number }> {
  const ipRows = await executor.rpInternalProductionRow.findMany();

  let linked = 0;
  let ambiguous = 0;
  const affectedRpIds = new Set<string>();

  for (const ip of ipRows) {
    const sourceRpNum = normalizeRpNum(ip.sourceRpNum);
    if (!sourceRpNum) continue;

    const rp = await executor.rpRequest.findUnique({
      where: { rpNum: sourceRpNum },
    });
    if (!rp) continue;

    const lineItems = await executor.rpLineItem.findMany({
      where: { rpRequestId: rp.id },
    });

    const panelItems = lineItems.filter(isPanelLineItem);
    let lineItemId: string | null = ip.sourceLineItemId;

    if (!lineItemId && isStockReplacementIp(ip.reason)) {
      if (panelItems.length === 1) {
        lineItemId = panelItems[0].id;
      } else if (panelItems.length > 1 && ip.panel) {
        const panelNorm = ip.panel.trim().toLowerCase();
        const matches = panelItems.filter(
          (item) => (item.panelName ?? "").trim().toLowerCase() === panelNorm,
        );
        if (matches.length === 1) {
          lineItemId = matches[0].id;
        } else {
          ambiguous++;
        }
      } else if (panelItems.length > 1) {
        ambiguous++;
      }
    }

    const ipUpdates: {
      sourceRpId: string;
      sourceLineItemId?: string;
      updatedAt: Date;
    } = {
      sourceRpId: rp.id,
      updatedAt: new Date(),
    };
    if (lineItemId) {
      ipUpdates.sourceLineItemId = lineItemId;
    }

    await executor.rpInternalProductionRow.update({
      where: { id: ip.id },
      data: ipUpdates,
    });

    if (lineItemId && isStockReplacementIp(ip.reason)) {
      const lineItem = panelItems.find((item) => item.id === lineItemId);
      if (lineItem && lineItem.fulfillment === "pending") {
        await executor.rpLineItem.update({
          where: { id: lineItemId },
          data: {
            fulfillment: "from_stock",
            stockReplacementIpId: ip.id,
            takenFromStockAt: ip.entryDate ?? ip.createdAt,
            takenFromStockBy: ip.ownerEmail,
            updatedAt: new Date(),
          },
        });
        linked++;
        affectedRpIds.add(rp.id);
      }
    }
  }

  for (const rpId of affectedRpIds) {
    await recomputeRpHeaderAfterStockChange(rpId, executor);
  }

  return { linked, ambiguous };
}

/** Rebuild line items for all RPs (post-import). */
export async function rebuildAllRpLineItems(
  executor: DbExecutor = prisma,
): Promise<number> {
  const rows = await executor.rpRequest.findMany();
  for (const row of rows) {
    await upsertRpLineItemsFromRow(row.id, row, executor);
  }
  return rows.length;
}

export async function getPanelLineItemsForRp(
  rpRequestId: string,
  executor: DbExecutor = prisma,
) {
  const items = await executor.rpLineItem.findMany({ where: { rpRequestId } });
  return items.filter(isPanelLineItem);
}

export async function getPanelLineItemsForRps(
  rpRequestIds: string[],
  executor: DbExecutor = prisma,
) {
  if (!rpRequestIds.length) return [];
  const items = await executor.rpLineItem.findMany({
    where: { rpRequestId: { in: rpRequestIds } },
  });
  return items.filter(isPanelLineItem);
}
