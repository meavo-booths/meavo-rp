import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";
import { getDashboardParts } from "@/lib/domain/dashboard-parts";
import { prisma } from "@/lib/prisma";
import type { ViewerContext } from "@/lib/viewer-context";

export type LogisticsView = "processing" | "ready" | "shipped" | "all";

export type LogisticsPartCard = DashboardPartCard & {
  factoryDisplay: string | null;
  daysSinceReady: number | null;
  shippingWeek: string | null;
  pallet: string | null;
};

function isReplacementPart(itemType: string | null): boolean {
  const t = (itemType ?? "").toUpperCase();
  return t.includes("PART") || t.includes("STOCK");
}

function parseTrackingForLogistics(tracking: string | null): {
  shippingWeek: string | null;
  pallet: string | null;
} {
  const raw = (tracking ?? "").trim();
  if (!raw) return { shippingWeek: null, pallet: null };
  const palletMatch = raw.match(/Pallet\s+(\S+)/i);
  const weekMatch = raw.match(/(W\d{1,2}\/\d{2,4}|Week\s+\d+)/i);
  return {
    shippingWeek: weekMatch?.[1] ?? null,
    pallet: palletMatch?.[1] ?? null,
  };
}

function computeDaysSinceReady(readyMarkedAt: Date | null): number | null {
  if (!readyMarkedAt) return null;
  const ms = Date.now() - readyMarkedAt.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

async function buildIpFactoryBySourceRp(): Promise<Map<string, string>> {
  const rows = await prisma.rpInternalProductionRow.findMany({
    where: { sourceRpNum: { not: null } },
    select: { sourceRpNum: true, factory: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    const key = (row.sourceRpNum ?? "").trim().toUpperCase();
    if (key && row.factory) map.set(key, row.factory);
  }
  return map;
}

function resolveFactoryDisplay(
  rpNum: string,
  reviewGroup: string | null,
  ipFactoryMap: Map<string, string>,
): string | null {
  const fromIp = ipFactoryMap.get(rpNum.trim().toUpperCase());
  if (fromIp) return fromIp;
  return reviewGroup;
}

function matchesLogisticsView(status: string, view: LogisticsView): boolean {
  const s = status.trim();
  if (view === "all") {
    return s !== "Cancelled";
  }
  if (view === "shipped") return s === "Shipped";
  if (view === "ready") return s === "Ready";
  return s !== "Shipped" && s !== "Cancelled" && s !== "Ready";
}

function sortLogisticsCards(
  cards: LogisticsPartCard[],
  view: LogisticsView,
): LogisticsPartCard[] {
  return [...cards].sort((a, b) => {
    if (view === "ready") {
      const aUrgent = a.urgency === "urgent";
      const bUrgent = b.urgency === "urgent";
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
    }
    const da = a.daysSinceReady;
    const db = b.daysSinceReady;
    if (da == null && db == null) {
      return Number(b.rpNum.replace(/\D/g, "")) - Number(a.rpNum.replace(/\D/g, ""));
    }
    if (da == null) return 1;
    if (db == null) return -1;
    if (db !== da) return db - da;
    return Number(b.rpNum.replace(/\D/g, "")) - Number(a.rpNum.replace(/\D/g, ""));
  });
}

export async function getLogisticsDashboardParts(
  viewer: ViewerContext,
  logisticsView: LogisticsView,
): Promise<LogisticsPartCard[]> {
  const all = await getDashboardParts({ viewer, viewType: "all" });
  const ipFactoryMap = await buildIpFactoryBySourceRp();
  const rpRows = await prisma.rpRequest.findMany({
    select: { rpNum: true, readyMarkedAt: true },
  });
  const readyMap = new Map(
    rpRows.map((r) => [r.rpNum, r.readyMarkedAt]),
  );

  const cards = all
    .filter((part) => isReplacementPart(part.itemType))
    .filter((part) =>
      matchesLogisticsView(part.status ?? "", logisticsView),
    )
    .map((part) => {
      const parsed = parseTrackingForLogistics(part.tracking);
      const readyAt = readyMap.get(part.rpNum) ?? null;
      return {
        ...part,
        factoryDisplay: resolveFactoryDisplay(
          part.rpNum,
          part.reviewGroup,
          ipFactoryMap,
        ),
        daysSinceReady: computeDaysSinceReady(readyAt),
        shippingWeek: parsed.shippingWeek,
        pallet: parsed.pallet,
      };
    });

  return sortLogisticsCards(cards, logisticsView);
}
