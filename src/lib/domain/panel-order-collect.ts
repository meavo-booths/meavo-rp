import type { RpInternalProductionRow, RpRequest } from "@prisma/client";

import { markPanelOrderSent, enqueueSheetSync } from "@/lib/domain/panel-orders";
import { prisma } from "@/lib/prisma";

export type PanelOrderEntry = {
  recordType: "rp" | "ip";
  recordId: string;
  rpNum: string;
  sourceRp?: string | null;
  factory: string;
  urgency: string;
  status: string | null;
  workshopNote: string | null;
  issueType?: string | null;
  boothId?: string | null;
  color?: string | null;
  itemType?: string | null;
  model?: string | null;
  partDescription?: string | null;
  clarifications?: string | null;
  notes?: string | null;
  market?: string | null;
  dueDate?: Date | null;
};

export type PanelUrgencyMode = "all" | "standard" | "urgent";

function isPanelItem(itemType: string | null | undefined): boolean {
  const t = (itemType ?? "").trim().toUpperCase();
  return !["PART", "PARTS", "STOCK", "SPARE", "OTHER PARTS"].some((x) =>
    t.includes(x),
  );
}

function matchesFactoryGroup(
  reviewGroup: string | null | undefined,
  factory: string,
): boolean {
  return (reviewGroup ?? "").toUpperCase().includes(factory.toUpperCase());
}

function matchesUrgencyMode(
  urgency: string | null | undefined,
  mode: PanelUrgencyMode,
): boolean {
  if (mode === "all") return true;
  const u = (urgency ?? "").toLowerCase();
  if (mode === "urgent") return u === "urgent";
  return u !== "urgent";
}

function matchesPanelOrderStatus(status: string | null | undefined): boolean {
  const token = (status ?? "").trim().toLowerCase();
  if (!token || token === "cancelled") return false;
  if (token === "ordered on amazon") return false;
  if (token === "ready" || token === "shipped") return true;
  if (token === "in production" || token === "briefed" || token === "active") {
    return true;
  }
  return false;
}

function isEligibleForWorkshopWarning(
  row: { status: string | null; orderSentAt: Date | null },
): boolean {
  if (row.orderSentAt) return false;
  return matchesPanelOrderStatus(row.status);
}

function rpToEntry(row: RpRequest): PanelOrderEntry {
  return {
    recordType: "rp",
    recordId: row.id,
    rpNum: row.rpNum,
    factory: row.reviewGroup ?? "",
    urgency: row.urgency,
    status: row.status,
    workshopNote: row.workshopNote,
    issueType: row.issueType,
    boothId: row.boothId,
    color: row.color,
    itemType: row.itemType,
    model: row.model,
    partDescription: row.partDescription,
    clarifications: row.clarifications,
    notes: row.notes,
    market: row.market,
    dueDate: row.dueDate,
  };
}

function ipToEntry(row: RpInternalProductionRow): PanelOrderEntry {
  return {
    recordType: "ip",
    recordId: row.id,
    rpNum: row.ipNum,
    sourceRp: row.sourceRpNum,
    factory: row.factory ?? "",
    urgency: row.urgency,
    status: row.status,
    workshopNote: row.workshopNote,
    itemType: row.panel,
    model: row.model,
    boothId: row.batch,
    color: row.colour,
    clarifications: row.panelClarification,
    notes: row.notes,
    dueDate: row.deadline,
  };
}

function dedupePanelEntries(entries: PanelOrderEntry[]): PanelOrderEntry[] {
  const suppressed = new Set<string>();
  for (const entry of entries) {
    if (entry.recordType === "ip" && entry.sourceRp) {
      suppressed.add(entry.sourceRp.replace(/\s+/g, "").toUpperCase());
    }
  }
  const out: PanelOrderEntry[] = [];
  for (const entry of entries) {
    if (entry.recordType === "rp") {
      const key = entry.rpNum.replace(/\s+/g, "").toUpperCase();
      if (suppressed.has(key)) continue;
    }
    out.push(entry);
  }
  return out;
}

export async function collectFactoryPanelsForOrder(
  factoryGroup: "KAZ" | "VAR",
  urgencyMode: PanelUrgencyMode,
): Promise<PanelOrderEntry[]> {
  const rpRows = await prisma.rpRequest.findMany({
    where: {
      reviewGroup: { contains: factoryGroup, mode: "insensitive" },
      orderSentAt: null,
    },
  });

  const ipRows = await prisma.rpInternalProductionRow.findMany({
    where: {
      factory: { contains: factoryGroup, mode: "insensitive" },
      orderSentAt: null,
    },
  });

  const rpEntries = rpRows
    .filter((row) => isPanelItem(row.itemType))
    .filter((row) => matchesFactoryGroup(row.reviewGroup, factoryGroup))
    .filter((row) => matchesPanelOrderStatus(row.status))
    .filter((row) => matchesUrgencyMode(row.urgency, urgencyMode))
    .filter((row) => (row.workshopNote ?? "").trim().length > 0)
    .map(rpToEntry);

  const ipEntries = ipRows
    .filter((row) => isPanelItem(row.panel))
    .filter((row) => matchesFactoryGroup(row.factory, factoryGroup))
    .filter((row) => matchesPanelOrderStatus(row.status))
    .filter((row) => matchesUrgencyMode(row.urgency, urgencyMode))
    .filter((row) => (row.workshopNote ?? "").trim().length > 0)
    .map(ipToEntry);

  return dedupePanelEntries([...ipEntries, ...rpEntries]);
}

export async function collectPanelsMissingWorkshopNote(
  urgencyMode: "standard" | "urgent",
  options?: { minAgeMs?: number },
): Promise<PanelOrderEntry[]> {
  const minAgeMs = options?.minAgeMs ?? 0;
  const cutoff = minAgeMs > 0 ? new Date(Date.now() - minAgeMs) : null;
  const factories = ["KAZ", "VAR"] as const;
  const out: PanelOrderEntry[] = [];

  for (const factory of factories) {
    const rpRows = await prisma.rpRequest.findMany({
      where: {
        reviewGroup: { contains: factory, mode: "insensitive" },
        OR: [{ workshopNote: null }, { workshopNote: "" }],
        orderSentAt: null,
      },
    });
    for (const row of rpRows) {
      if (!isPanelItem(row.itemType)) continue;
      if (!matchesUrgencyMode(row.urgency, urgencyMode)) continue;
      if (!isEligibleForWorkshopWarning(row)) continue;
      if (cutoff && row.entryDate && row.entryDate > cutoff) continue;
      out.push(rpToEntry(row));
    }

    const ipRows = await prisma.rpInternalProductionRow.findMany({
      where: {
        factory: { contains: factory, mode: "insensitive" },
        OR: [{ workshopNote: null }, { workshopNote: "" }],
        orderSentAt: null,
      },
    });
    for (const row of ipRows) {
      if (!isPanelItem(row.panel)) continue;
      if (!matchesUrgencyMode(row.urgency, urgencyMode)) continue;
      if (!isEligibleForWorkshopWarning(row)) continue;
      if (cutoff && row.entryDate && row.entryDate > cutoff) continue;
      out.push(ipToEntry(row));
    }
  }

  return out;
}

export async function markPanelOrderEntriesSent(
  entries: PanelOrderEntry[],
): Promise<void> {
  const now = new Date();
  for (const entry of entries) {
    if (entry.recordType === "rp") {
      await markPanelOrderSent(entry.recordId);
      continue;
    }
    await prisma.rpInternalProductionRow.update({
      where: { id: entry.recordId },
      data: { orderSentAt: now, updatedAt: now },
    });
    await enqueueSheetSync("ip", entry.recordId);
  }
}
