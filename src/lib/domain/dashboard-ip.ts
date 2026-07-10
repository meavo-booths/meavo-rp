import type { RpInternalProductionRow } from "@prisma/client";

import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";
import { prisma } from "@/lib/prisma";

export type IpDashboardCard = {
  id: string;
  ipNum: string;
  recordType: "ip";
  due: string | null;
  user: string | null;
  issue: string | null;
  priority: string;
  model: string | null;
  panel: string | null;
  batch: string | null;
  color: string | null;
  warehouse: string | null;
  factory: string | null;
  sourceRp: string | null;
  clarification: string | null;
  note: string | null;
  workshopNote: string | null;
  status: string | null;
  tracking: string | null;
};

function toIpCard(row: RpInternalProductionRow): IpDashboardCard {
  return {
    id: row.id,
    ipNum: row.ipNum,
    recordType: "ip",
    due: row.deadline?.toISOString().slice(0, 10) ?? null,
    user: row.ownerEmail,
    issue: row.reason,
    priority: row.urgency,
    model: row.model,
    panel: row.panel,
    batch: row.batch,
    color: row.colour,
    warehouse: row.warehouse,
    factory: row.factory,
    sourceRp: row.sourceRpNum,
    clarification: row.panelClarification,
    note: row.notes,
    workshopNote: row.workshopNote,
    status: row.status,
    tracking: row.tracking,
  };
}

/** Map an IP row into the shared dashboard card shape (recordType "ip"). */
export function ipCardToPartCard(ip: IpDashboardCard): DashboardPartCard {
  return {
    id: ip.id,
    recordType: "ip",
    rpNum: ip.ipNum,
    dueDate: ip.due,
    market: null,
    userId: ip.user,
    issueType: ip.issue,
    urgency: ip.priority,
    model: ip.model,
    boothId: ip.batch,
    color: ip.color,
    itemType: ip.panel,
    quantity: null,
    partRpCode: null,
    partDescription: ip.panel,
    clarifications: ip.clarification,
    notes: ip.note,
    client: null,
    address: null,
    recipient: null,
    phone: null,
    email: null,
    shipMethod: null,
    status: ip.status,
    tracking: ip.tracking,
    reviewGroup: ip.factory,
    workshopNote: ip.workshopNote,
    canEditRp: false,
    editRpDisabledReason: "",
    items: [],
  };
}

function parseDueForSort(value: string | null): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Merge RP + IP cards into one feed, sorted like GAS
 * sortNikolayDashboardEntries_: urgent first, due date asc, number desc.
 */
export function mergeRpAndIpCards(
  rpCards: DashboardPartCard[],
  ipCards: IpDashboardCard[],
): DashboardPartCard[] {
  const combined = [...rpCards, ...ipCards.map(ipCardToPartCard)];
  return combined.sort((a, b) => {
    const aUrgent = (a.urgency ?? "").toLowerCase() === "urgent";
    const bUrgent = (b.urgency ?? "").toLowerCase() === "urgent";
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    const aDue = parseDueForSort(a.dueDate);
    const bDue = parseDueForSort(b.dueDate);
    if (aDue !== null && bDue !== null && aDue !== bDue) return aDue - bDue;
    if (aDue !== null && bDue === null) return -1;
    if (aDue === null && bDue !== null) return 1;
    const aNum = Number(a.rpNum.replace(/\D/g, "")) || 0;
    const bNum = Number(b.rpNum.replace(/\D/g, "")) || 0;
    return bNum - aNum;
  });
}

export async function getIpDashboardCards(options: {
  factoryTokens: string[];
  viewType?: string;
  sourceFilter?: string;
}): Promise<IpDashboardCard[]> {
  const rows = await prisma.rpInternalProductionRow.findMany({
    orderBy: { ipNum: "desc" },
  });
  const view = options.viewType ?? "active";
  const source = (options.sourceFilter ?? "").trim().toLowerCase();

  return rows
    .filter((row) => {
      const factory = (row.factory ?? "").toUpperCase();
      if (!options.factoryTokens.some((t) => factory.includes(t.toUpperCase()))) {
        return false;
      }
      if (source) {
        const sr = (row.sourceRpNum ?? "").toLowerCase();
        if (!sr.includes(source)) return false;
      }
      const status = (row.status ?? "").trim();
      if (view === "archive") {
        return status === "Shipped" || status === "Delivered";
      }
      if (view === "ready") return status === "Ready";
      return status !== "Shipped" && status !== "Cancelled" && status !== "Delivered";
    })
    .map(toIpCard);
}
