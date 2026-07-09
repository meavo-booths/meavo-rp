import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";
import { getDashboardParts } from "@/lib/domain/dashboard-parts";
import type { ViewerContext } from "@/lib/viewer-context";

export type LogisticsView = "processing" | "ready" | "shipped";

function isReplacementPart(itemType: string | null): boolean {
  const t = (itemType ?? "").toUpperCase();
  return t.includes("PART") || t.includes("STOCK");
}

export async function getLogisticsDashboardParts(
  viewer: ViewerContext,
  logisticsView: LogisticsView,
): Promise<DashboardPartCard[]> {
  const all = await getDashboardParts({
    viewer,
    viewType: "all",
  });

  return all.filter((part) => {
    if (!isReplacementPart(part.itemType)) return false;
    const status = (part.status ?? "").trim();
    if (logisticsView === "shipped") {
      return status === "Shipped";
    }
    if (logisticsView === "ready") {
      return status === "Ready";
    }
    return status !== "Shipped" && status !== "Cancelled" && status !== "Ready";
  });
}
