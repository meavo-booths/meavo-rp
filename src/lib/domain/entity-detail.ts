import { normalizeRpNum } from "@/lib/domain/rp-numbers";
import {
  loadEntityTimeline,
  type LifecycleEntityType,
  type TimelineEntry,
} from "@/lib/domain/lifecycle-events";
import { prisma } from "@/lib/prisma";

export type EntityDetailLineItem = {
  id: string;
  lineIndex: number;
  kind: string;
  panelName: string | null;
  quantity: string | null;
  partRpCode: string | null;
  partDescription: string | null;
  clarifications: string | null;
  fulfillment: string;
  takenFromStockAt: string | null;
  takenFromStockBy: string | null;
};

export type EntityDetailPhoto = {
  id: string;
  url: string;
  label: string | null;
  createdAt: string;
};

export type EntityDetail = {
  recordType: LifecycleEntityType;
  id: string;
  num: string;
  status: string | null;
  urgency: string | null;
  entryDate: string | null;
  dueDate: string | null;
  market: string | null;
  ownerEmail: string | null;
  issueType: string | null;
  model: string | null;
  boothId: string | null;
  color: string | null;
  itemType: string | null;
  quantity: string | null;
  partRpCode: string | null;
  partDescription: string | null;
  clarifications: string | null;
  notes: string | null;
  client: string | null;
  address: string | null;
  recipient: string | null;
  phone: string | null;
  email: string | null;
  reviewGroup: string | null;
  shipMethod: string | null;
  tracking: string | null;
  payer: string | null;
  workshopNote: string | null;
  orderSentAt: string | null;
  readyMarkedAt: string | null;
  warehouse: string | null;
  factory: string | null;
  sourceRpNum: string | null;
  stockReplacementSummary: string | null;
  lineItems: EntityDetailLineItem[];
  photos: EntityDetailPhoto[];
  timeline: TimelineEntry[];
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export async function getEntityDetail(
  recordType: LifecycleEntityType,
  recordNum: string,
): Promise<EntityDetail> {
  if (recordType === "rp") {
    const rpNum = normalizeRpNum(recordNum);
    const row = await prisma.rpRequest.findUnique({
      where: { rpNum },
      include: {
        lineItems: { orderBy: { lineIndex: "asc" } },
        photos: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!row) throw new Error("RP not found");

    const timeline = await loadEntityTimeline("rp", row.id, {
      entryDate: row.entryDate,
      createdAt: row.createdAt,
      orderSentAt: row.orderSentAt,
      readyMarkedAt: row.readyMarkedAt,
      notes: row.notes,
      stockEvents: row.lineItems
        .filter((li) => li.takenFromStockAt)
        .map((li) => ({
          at: li.takenFromStockAt!,
          by: li.takenFromStockBy,
          detail: li.panelName || li.partDescription || `line ${li.lineIndex + 1}`,
        })),
      photoEvents: row.photos.map((p) => ({
        at: p.createdAt,
        detail: p.label,
      })),
    });

    return {
      recordType: "rp",
      id: row.id,
      num: row.rpNum,
      status: row.status,
      urgency: row.urgency,
      entryDate: iso(row.entryDate),
      dueDate: iso(row.dueDate),
      market: row.market,
      ownerEmail: row.userId,
      issueType: row.issueType,
      model: row.model,
      boothId: row.boothId,
      color: row.color,
      itemType: row.itemType,
      quantity: row.quantity,
      partRpCode: row.partRpCode,
      partDescription: row.partDescription,
      clarifications: row.clarifications,
      notes: row.notes,
      client: row.client,
      address: row.address,
      recipient: row.recipient,
      phone: row.phone,
      email: row.email,
      reviewGroup: row.reviewGroup,
      shipMethod: row.shipMethod,
      tracking: row.tracking,
      payer: row.payer,
      workshopNote: row.workshopNote,
      orderSentAt: iso(row.orderSentAt),
      readyMarkedAt: iso(row.readyMarkedAt),
      warehouse: null,
      factory: row.reviewGroup,
      sourceRpNum: null,
      stockReplacementSummary: row.stockReplacementSummary,
      lineItems: row.lineItems.map((li) => ({
        id: li.id,
        lineIndex: li.lineIndex,
        kind: li.kind,
        panelName: li.panelName,
        quantity: li.quantity,
        partRpCode: li.partRpCode,
        partDescription: li.partDescription,
        clarifications: li.clarifications,
        fulfillment: li.fulfillment,
        takenFromStockAt: iso(li.takenFromStockAt),
        takenFromStockBy: li.takenFromStockBy,
      })),
      photos: row.photos.map((p) => ({
        id: p.id,
        url: p.url,
        label: p.label,
        createdAt: p.createdAt.toISOString(),
      })),
      timeline,
    };
  }

  const ipNum = recordNum.trim();
  const row = await prisma.rpInternalProductionRow.findUnique({
    where: { ipNum },
  });
  if (!row) throw new Error("IP not found");

  const timeline = await loadEntityTimeline("ip", row.id, {
    entryDate: row.entryDate,
    createdAt: row.createdAt,
    orderSentAt: row.orderSentAt,
    notes: row.notes,
  });

  return {
    recordType: "ip",
    id: row.id,
    num: row.ipNum,
    status: row.status,
    urgency: row.urgency,
    entryDate: iso(row.entryDate),
    dueDate: iso(row.deadline),
    market: null,
    ownerEmail: row.ownerEmail,
    issueType: row.reason,
    model: row.model,
    boothId: row.batch,
    color: row.colour,
    itemType: row.panel,
    quantity: null,
    partRpCode: null,
    partDescription: row.panel,
    clarifications: row.panelClarification,
    notes: row.notes,
    client: null,
    address: null,
    recipient: null,
    phone: null,
    email: null,
    reviewGroup: row.factory,
    shipMethod: null,
    tracking: row.tracking,
    payer: row.payer,
    workshopNote: row.workshopNote,
    orderSentAt: iso(row.orderSentAt),
    readyMarkedAt: null,
    warehouse: row.warehouse,
    factory: row.factory,
    sourceRpNum: row.sourceRpNum,
    stockReplacementSummary: null,
    lineItems: [],
    photos: [],
    timeline,
  };
}
