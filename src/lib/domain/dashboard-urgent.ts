import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";
import {
  getDashboardParts,
  getDashboardPartsAllOwners,
} from "@/lib/domain/dashboard-parts";
import { getIpDashboardCards, mergeRpAndIpCards } from "@/lib/domain/dashboard-ip";
import type { ViewerContext } from "@/lib/viewer-context";

export type UrgentPanelView =
  | "unbriefed"
  | "in_production"
  | "ready"
  | "shipped";

function isPanelItem(itemType: string | null): boolean {
  const t = (itemType ?? "").toUpperCase();
  return !["PART", "PARTS", "STOCK", "SPARE"].some((x) => t.includes(x));
}

function matchesFactory(
  reviewGroup: string | null,
  factory: string,
): boolean {
  const g = (reviewGroup ?? "").toUpperCase();
  return g.includes(factory.toUpperCase());
}

export async function getUrgentPanelCards(
  viewer: ViewerContext,
  panelView: UrgentPanelView,
  factoryFilter?: string,
): Promise<DashboardPartCard[]> {
  const all = await getDashboardParts({ viewer, viewType: "all" });
  return all.filter((part) => {
    if (part.urgency !== "urgent") return false;
    if (!isPanelItem(part.itemType)) return false;
    if (factoryFilter && !matchesFactory(part.reviewGroup, factoryFilter)) {
      return false;
    }
    // Bucketing mirrors GAS matchesActiveUrgentPanelsStatus_: Briefed counts
    // as "in production"; unbriefed is everything outside the named statuses.
    const status = (part.status ?? "").trim();
    if (panelView === "in_production") {
      return status === "In Production" || status === "Briefed";
    }
    if (panelView === "ready") return status === "Ready";
    if (panelView === "shipped") return status === "Shipped";
    return !["In Production", "Briefed", "Ready", "Shipped", "Cancelled"].includes(
      status,
    );
  });
}

export async function getKalinAllRpsCards(
  viewer: ViewerContext,
  viewType: "active" | "archive" | "cancelled" = "active",
  factoryFilter?: string,
): Promise<DashboardPartCard[]> {
  // GAS getKalinAllRpsDashboardData: RP rows from all owners merged with IP
  // rows from all three factories in one sorted feed.
  const [rpCards, ipCards] = await Promise.all([
    getDashboardPartsAllOwners({ viewer, viewType, factoryFilter }),
    getIpDashboardCards({
      factoryTokens: factoryFilter ? [factoryFilter] : ["AKS", "VAR", "KAZ"],
      viewType,
    }),
  ]);
  return mergeRpAndIpCards(rpCards, ipCards);
}
