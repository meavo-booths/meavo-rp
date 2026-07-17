"use client";

import Link from "next/link";

import {
  buildFilterHref,
  collectMarketOptions,
  type DashboardFilterCapabilities,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";

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
  basePath,
  currentQuery = "",
}: {
  parts: DashboardPartCard[];
  filters: DashboardFilterState;
  capabilities: DashboardFilterCapabilities;
  basePath?: string;
  currentQuery?: string;
}) {
  const path = basePath ?? "";
  const current = new URLSearchParams(currentQuery);

  const href = (updates: Partial<DashboardFilterState>) =>
    buildFilterHref(path, current, updates);

  const hasAny =
    capabilities.market ||
    capabilities.factory ||
    capabilities.source ||
    capabilities.item ||
    capabilities.sort;

  if (!hasAny) return null;

  const marketOptions = capabilities.market
    ? [
        { value: "all", label: "Всички пазари" },
        ...collectMarketOptions(parts).map((m) => ({ value: m, label: m })),
      ]
    : [];

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {capabilities.market ? (
        <FilterSelect
          label="Пазар"
          value={filters.market}
          options={marketOptions}
          onChangeHref={(v) => href({ market: v })}
        />
      ) : null}
      {capabilities.factory ? (
        <FilterSelect
          label="Фабрика"
          value={filters.factory}
          options={[
            { value: "all", label: "Всички" },
            { value: "AKS", label: "AKS" },
            { value: "VAR", label: "VAR" },
            { value: "KAZ", label: "KAZ" },
          ]}
          onChangeHref={(v) => href({ factory: v })}
        />
      ) : null}
      {capabilities.source ? (
        <FilterSelect
          label="Източник"
          value={filters.source}
          options={[
            { value: "all", label: "Всички" },
            { value: "rp", label: "Резервни части" },
            { value: "ip", label: "Вътрешна продукция" },
          ]}
          onChangeHref={(v) => href({ source: v })}
        />
      ) : null}
      {capabilities.item ? (
        <FilterSelect
          label="Тип"
          value={filters.item}
          options={[
            { value: "all", label: "Всички" },
            { value: "parts", label: "Части" },
            { value: "panels", label: "Панели" },
          ]}
          onChangeHref={(v) => href({ item: v })}
        />
      ) : null}
      {capabilities.sort ? (
        <FilterSelect
          label="Подредба"
          value={filters.sort}
          options={[
            { value: "newest", label: "Най-нови" },
            { value: "oldest", label: "Най-стари" },
          ]}
          onChangeHref={(v) => href({ sort: v as "newest" | "oldest" })}
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
          Изчисти филтри
        </Link>
      )}
    </div>
  );
}
