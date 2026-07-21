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
    <div className="space-y-2">
      {hasTopRow ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {onSearchChange ? (
            <div className="w-full sm:max-w-xl sm:flex-1">
              <Input
                type="search"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="!rounded-full border-slate-300 bg-white"
              />
            </div>
          ) : (
            <div />
          )}
          {capabilities.sort ? (
            <div className="sm:shrink-0">
              <label className="flex items-center gap-2 text-xs">
                <span className="sr-only sm:not-sr-only sm:font-semibold sm:uppercase sm:tracking-wide sm:text-slate-500">
                  {labels.sortLabel}
                </span>
                <select
                  value={filters.sort}
                  onChange={(e) => {
                    window.location.href = href({
                      sort: e.target.value as "newest" | "oldest",
                    });
                  }}
                  aria-label={labels.sortLabel}
                  className="rounded-full border border-slate-300 bg-white px-3 py-2 text-[0.8125rem] font-semibold text-slate-800 hover:border-brand-600"
                >
                  <option value="newest">{labels.sortNewest}</option>
                  <option value="oldest">{labels.sortOldest}</option>
                </select>
              </label>
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
              className="rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              {labels.clearFilters}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
