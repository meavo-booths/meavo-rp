import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";

export type DashboardFilterState = {
  market: string;
  factory: string;
  source: string;
  item: string;
  sort: "newest" | "oldest";
};

export type DashboardFilterCapabilities = {
  market?: boolean;
  factory?: boolean;
  source?: boolean;
  item?: boolean;
  sort?: boolean;
};

export const DEFAULT_FILTER_STATE: DashboardFilterState = {
  market: "all",
  factory: "all",
  source: "all",
  item: "all",
  sort: "newest",
};

export function parseFilterState(
  params: Record<string, string | undefined>,
): DashboardFilterState {
  return {
    market: params.market ?? "all",
    factory: params.factory ?? "all",
    source: params.source ?? "all",
    item: params.item ?? "all",
    sort: params.sort === "oldest" ? "oldest" : "newest",
  };
}

export function isPartItemType(itemType: string | null | undefined): boolean {
  const t = (itemType ?? "").toUpperCase();
  return ["PART", "PARTS", "STOCK", "SPARE"].some((x) => t.includes(x));
}

function matchesFactory(reviewGroup: string | null, factory: string): boolean {
  if (factory === "all") return true;
  return (reviewGroup ?? "").trim().toUpperCase().includes(factory);
}

function matchesMarket(market: string | null, filter: string): boolean {
  if (filter === "all") return true;
  return (market ?? "").trim().toLowerCase() === filter.trim().toLowerCase();
}

function matchesItemFilter(
  part: DashboardPartCard,
  item: string,
): boolean {
  if (item === "all") return true;
  const isPart = isPartItemType(part.itemType);
  if (item === "parts") return isPart;
  if (item === "panels") return !isPart;
  return true;
}

export function collectMarketOptions(parts: DashboardPartCard[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const market = (part.market ?? "").trim();
    if (!market) continue;
    const key = market.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(market);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function applyDashboardFilters<T extends DashboardPartCard>(
  parts: T[],
  filters: DashboardFilterState,
  caps: DashboardFilterCapabilities,
  search: string,
): T[] {
  const q = search.trim().toLowerCase();

  let result = parts.filter((part) => {
    if (caps.market && !matchesMarket(part.market, filters.market)) return false;
    if (caps.factory && !matchesFactory(part.reviewGroup, filters.factory)) {
      return false;
    }
    if (caps.item && !matchesItemFilter(part, filters.item)) return false;
    if (q) {
      const haystack = [
        part.rpNum,
        part.client,
        part.market,
        part.itemType,
        part.partDescription,
        part.userId,
        part.boothId,
        part.model,
        part.color,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (caps.sort) {
    result = [...result].sort((a, b) => {
      const aNum = Number(a.rpNum.replace(/\D/g, "")) || 0;
      const bNum = Number(b.rpNum.replace(/\D/g, "")) || 0;
      return filters.sort === "oldest" ? aNum - bNum : bNum - aNum;
    });
  }

  return result;
}

export function buildFilterHref(
  basePath: string,
  current: URLSearchParams,
  updates: Partial<DashboardFilterState> & Record<string, string | undefined>,
): string {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
