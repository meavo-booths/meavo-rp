"use client";

import Link from "next/link";

import { Input } from "@/components/ui";
import {
  buildFilterHref,
  collectMarketOptions,
  type DashboardFilterCapabilities,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";
import type { DashboardUiLabels } from "@/lib/ui-locale";

function FilterSelect({
  label,
  value,
  options,
  onChangeHref,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChangeHref: (value: string) => string;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs">
      <span className="font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          window.location.href = onChangeHref(e.target.value);
        }}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DashboardFilters({
  parts,
  filters,
  capabilities,
  labels,
  basePath,
  currentQuery = "",
  searchValue,
  onSearchChange,
  searchPlaceholder,
}: {
  parts: DashboardPartCard[];
  filters: DashboardFilterState;
  capabilities: DashboardFilterCapabilities;
  labels: Pick<
    DashboardUiLabels,
    | "sortLabel"
    | "sortNewest"
    | "sortOldest"
    | "clearFilters"
    | "marketLabel"
    | "marketAll"
    | "factoryLabel"
    | "factoryAll"
    | "sourceLabel"
    | "sourceAll"
    | "sourceRp"
    | "sourceIp"
    | "itemLabel"
    | "itemAll"
    | "itemParts"
    | "itemPanels"
  >;
  basePath?: string;
  currentQuery?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}) {
  const path = basePath ?? "";
  const current = new URLSearchParams(currentQuery);

  const href = (updates: Partial<DashboardFilterState>) =>
    buildFilterHref(path, current, updates);

  const hasAny =
    Boolean(onSearchChange) ||
    capabilities.market ||
    capabilities.factory ||
    capabilities.source ||
    capabilities.item ||
    capabilities.sort;

  if (!hasAny) return null;

  const marketOptions = capabilities.market
    ? [
        { value: "all", label: labels.marketAll },
        ...collectMarketOptions(parts).map((m) => ({ value: m, label: m })),
      ]
    : [];
  const hasTopRow = Boolean(onSearchChange) || capabilities.sort;
  const hasExtraFilters =
    capabilities.market || capabilities.factory || capabilities.source || capabilities.item;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {hasTopRow ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          {onSearchChange ? (
            <div className="w-full md:max-w-xl md:flex-1">
              <Input
                type="search"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
          ) : (
            <div />
          )}
          {capabilities.sort ? (
            <div className="md:shrink-0">
              <FilterSelect
                label={labels.sortLabel}
                value={filters.sort}
                options={[
                  { value: "newest", label: labels.sortNewest },
                  { value: "oldest", label: labels.sortOldest },
                ]}
                onChangeHref={(v) => href({ sort: v as "newest" | "oldest" })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {hasExtraFilters ? (
        <div className="flex flex-wrap items-end gap-3">
          {capabilities.market ? (
            <FilterSelect
              label={labels.marketLabel}
              value={filters.market}
              options={marketOptions}
              onChangeHref={(v) => href({ market: v })}
            />
          ) : null}
          {capabilities.factory ? (
            <FilterSelect
              label={labels.factoryLabel}
              value={filters.factory}
              options={[
                { value: "all", label: labels.factoryAll },
                { value: "AKS", label: "AKS" },
                { value: "VAR", label: "VAR" },
                { value: "KAZ", label: "KAZ" },
              ]}
              onChangeHref={(v) => href({ factory: v })}
            />
          ) : null}
          {capabilities.source ? (
            <FilterSelect
              label={labels.sourceLabel}
              value={filters.source}
              options={[
                { value: "all", label: labels.sourceAll },
                { value: "rp", label: labels.sourceRp },
                { value: "ip", label: labels.sourceIp },
              ]}
              onChangeHref={(v) => href({ source: v })}
            />
          ) : null}
          {capabilities.item ? (
            <FilterSelect
              label={labels.itemLabel}
              value={filters.item}
              options={[
                { value: "all", label: labels.itemAll },
                { value: "parts", label: labels.itemParts },
                { value: "panels", label: labels.itemPanels },
              ]}
              onChangeHref={(v) => href({ item: v })}
            />
          ) : null}
          {(filters.market !== "all" ||
            filters.factory !== "all" ||
            filters.source !== "all" ||
            filters.item !== "all") && (
            <Link
              href={path}
              className="rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
            >
              {labels.clearFilters}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
