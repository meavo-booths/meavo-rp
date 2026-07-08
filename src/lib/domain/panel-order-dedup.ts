/**
 * Line-item-aware panel order deduplication.
 * Replaces legacy dedupeKazPanelOrderEntries_ whole-RP suppression.
 */

import type { RpLineItem, RpRequest } from "@prisma/client";
import { isPanelLineItem } from "@/lib/domain/rp-line-items";

export type RpPanelOrderEntry = {
  recordType: "rp";
  rpRequestId: string;
  rpNum: string;
  lineItemId: string;
  lineIndex: number;
  panelName: string | null;
  fulfillment: RpLineItem["fulfillment"];
  reviewGroup: string | null;
  status: string | null;
  urgency: RpRequest["urgency"];
  model: string | null;
  market: string | null;
};

export type IpPanelOrderEntry = {
  recordType: "ip";
  ipId: string;
  ipNum: string;
  sourceRpId: string | null;
  sourceLineItemId: string | null;
  sourceRpNum: string | null;
  panelName: string | null;
  factory: string | null;
  status: string | null;
  urgency: string | null;
};

export type PanelOrderEntry = RpPanelOrderEntry | IpPanelOrderEntry;

/** Pending panel line items eligible for factory order dashboards. */
export function selectPendingRpPanelLineItems(
  rp: RpRequest,
  lineItems: RpLineItem[],
): RpPanelOrderEntry[] {
  return lineItems
    .filter(isPanelLineItem)
    .filter((item) => item.fulfillment === "pending")
    .map((item) => ({
      recordType: "rp" as const,
      rpRequestId: rp.id,
      rpNum: rp.rpNum,
      lineItemId: item.id,
      lineIndex: item.lineIndex,
      panelName: item.panelName,
      fulfillment: item.fulfillment,
      reviewGroup: rp.reviewGroup,
      status: rp.status,
      urgency: rp.urgency,
      model: rp.model,
      market: rp.market,
    }));
}

/**
 * Merge RP panel line entries with IP entries.
 * Legacy whole-RP suppression is replaced: only line items with stock IPs are hidden.
 */
export function mergePanelOrderEntries(
  rpEntries: RpPanelOrderEntry[],
  ipEntries: IpPanelOrderEntry[],
): PanelOrderEntry[] {
  const suppressedLineItemIds = new Set(
    ipEntries
      .map((entry) => entry.sourceLineItemId)
      .filter((id): id is string => Boolean(id)),
  );

  const visibleRpEntries = rpEntries.filter(
    (entry) => !suppressedLineItemIds.has(entry.lineItemId),
  );

  return [...ipEntries, ...visibleRpEntries];
}

/** Build IP dashboard entries from internal production rows. */
export function toIpPanelOrderEntry(row: {
  id: string;
  ipNum: string;
  sourceRpId: string | null;
  sourceLineItemId: string | null;
  sourceRpNum: string | null;
  panel: string | null;
  factory: string | null;
  status: string | null;
  urgency: string | null;
}): IpPanelOrderEntry {
  return {
    recordType: "ip",
    ipId: row.id,
    ipNum: row.ipNum,
    sourceRpId: row.sourceRpId,
    sourceLineItemId: row.sourceLineItemId,
    sourceRpNum: row.sourceRpNum,
    panelName: row.panel,
    factory: row.factory,
    status: row.status,
    urgency: row.urgency,
  };
}

/** @deprecated Whole-RP suppression — use line-item merge instead. */
export function isRpFullySuppressedByStockIps(
  rpRequestId: string,
  panelLineItems: RpLineItem[],
): boolean {
  const panels = panelLineItems.filter(isPanelLineItem);
  if (!panels.length) return false;
  return panels.every((item) => item.fulfillment === "from_stock");
}
