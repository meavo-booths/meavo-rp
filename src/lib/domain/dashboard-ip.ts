import type { RpInternalProductionRow } from "@prisma/client";

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
