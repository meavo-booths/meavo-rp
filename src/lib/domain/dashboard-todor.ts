import { prisma } from "@/lib/prisma";

export type TodorIpCard = {
  ipNum: string;
  panel: string | null;
  batch: string | null;
  warehouse: string | null;
  status: string | null;
  factory: string | null;
};

export async function getTodorTopoliIpCards(): Promise<TodorIpCard[]> {
  const rows = await prisma.rpInternalProductionRow.findMany({
    where: {
      warehouse: { contains: "topoli", mode: "insensitive" },
    },
    orderBy: { ipNum: "desc" },
  });
  return rows.map((r) => ({
    ipNum: r.ipNum,
    panel: r.panel,
    batch: r.batch,
    warehouse: r.warehouse,
    status: r.status,
    factory: r.factory,
  }));
}

export async function getTodorExportRpRows(week: "this" | "next"): Promise<
  {
    rpNum: string;
    market: string | null;
    status: string | null;
    shipMethod: string | null;
    reviewGroup: string | null;
  }[]
> {
  const rows = await prisma.rpRequest.findMany({
    where: {
      OR: [
        { reviewGroup: { contains: "VAR", mode: "insensitive" } },
        { reviewGroup: { contains: "AKS", mode: "insensitive" } },
      ],
      status: { in: ["Ready", "Briefed", "In Production"] },
    },
    orderBy: { rpNum: "desc" },
    select: {
      rpNum: true,
      market: true,
      status: true,
      shipMethod: true,
      reviewGroup: true,
      dueDate: true,
    },
  });
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weekStart =
    week === "next"
      ? new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000)
      : monday;
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  return rows.filter((r) => {
    if (!r.dueDate) return week === "this";
    return r.dueDate >= weekStart && r.dueDate < weekEnd;
  });
}
