"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { ItemsList } from "@/components/dashboard/items-list";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import {
  applyDashboardFilters,
  parseFilterState,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import type { LogisticsPartCard, LogisticsView } from "@/lib/domain/dashboard-logistics";
import { getDashboardUiLabels } from "@/lib/ui-locale";
import type { ViewerContext } from "@/lib/viewer-context";

const TABS: { id: LogisticsView; label: string }[] = [
  { id: "processing", label: "Processing" },
  { id: "ready", label: "Ready to ship" },
  { id: "shipped", label: "Shipped" },
  { id: "all", label: "All" },
];

function InfoLine({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="text-sm">
      <span className="text-slate-500">{label}: </span>
      {strong ? <strong className="text-slate-900">{children}</strong> : children}
    </div>
  );
}

export function LogisticsDashboard({
  viewer,
  parts,
  view,
  initialFilters,
}: {
  viewer: ViewerContext;
  parts: LogisticsPartCard[];
  view: LogisticsView;
  initialFilters: DashboardFilterState;
}) {
  const [search, setSearch] = useState("");
  useDashboardRefresh();
  const labels = getDashboardUiLabels("logistics");

  const filtered = useMemo(
    () =>
      applyDashboardFilters(parts, initialFilters, { market: true }, search),
    [parts, initialFilters, search],
  );

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/dashboard/logistics?view=${tab.id}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === tab.id
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-600"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <DashboardFilters
        parts={parts}
        filters={initialFilters}
        capabilities={{ market: true }}
        labels={labels}
        basePath={`/dashboard/logistics?view=${view}`}
        currentQuery={initialFilters.market !== "all" ? `market=${initialFilters.market}` : ""}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={labels.searchPlaceholder}
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">{labels.emptyView}</p>
      ) : null}

      <div className="grid gap-3">
        {filtered.map((part) => {
          const isUrgent = part.urgency === "urgent";
          const highlightUrgent = view === "ready" && isUrgent;
          const showModel =
            part.model && part.model.toLowerCase() !== "other";
          const showBooth =
            part.boothId && part.boothId.toLowerCase() !== "stock";
          const showColor =
            part.color && part.color.toLowerCase() !== "part";

          return (
            <div
              key={part.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                highlightUrgent
                  ? "border-amber-300 bg-amber-50/40"
                  : "border-slate-200"
              }`}
            >
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="space-y-1 border-slate-200 lg:border-r lg:pr-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {part.rpNum}
                    </h2>
                    <div className="flex flex-wrap gap-1">
                      {highlightUrgent ? (
                        <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                          СПЕШНО
                        </span>
                      ) : null}
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                        {part.status || "—"}
                      </span>
                    </div>
                  </div>
                  {showBooth || showModel || showColor ? (
                    <div className="space-y-0.5 pt-1">
                      {showBooth ? (
                        <InfoLine label="Booth" strong>
                          {part.boothId}
                        </InfoLine>
                      ) : null}
                      {showModel ? (
                        <InfoLine label="Модел">{part.model}</InfoLine>
                      ) : null}
                      {showColor ? (
                        <InfoLine label="Цвят">{part.color}</InfoLine>
                      ) : null}
                    </div>
                  ) : null}
                  <InfoLine label="Дни от Ready" strong>
                    {part.daysSinceReady ?? "—"}
                  </InfoLine>
                  <InfoLine label="Фабрика" strong>
                    {part.factoryDisplay ?? part.reviewGroup ?? "—"}
                  </InfoLine>
                  <InfoLine label="Седмица изпращане" strong>
                    {part.shippingWeek ?? "—"}
                  </InfoLine>
                  <InfoLine label="Палет" strong>
                    {part.pallet ?? "—"}
                  </InfoLine>
                </div>

                <div className="space-y-2 border-slate-200 lg:border-r lg:px-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Артикули
                  </p>
                  <ItemsList items={part.items} />
                  {part.clarifications ? (
                    <InfoLine label="Уточнения">
                      {part.clarifications}
                    </InfoLine>
                  ) : null}
                  <div className="pt-1">
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {part.dueDate || "TBC"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 border-slate-200 lg:border-r lg:px-4">
                  <InfoLine label="Получател">{part.recipient || "—"}</InfoLine>
                  <InfoLine label="Пазар" strong>
                    {part.market || "—"}
                  </InfoLine>
                  <InfoLine label="Клиент">{part.client || "—"}</InfoLine>
                  <InfoLine label="Адрес">{part.address || "—"}</InfoLine>
                  {part.phone ? (
                    <InfoLine label="Телефон">{part.phone}</InfoLine>
                  ) : null}
                </div>

                <div className="space-y-1 lg:pl-2">
                  <InfoLine label="Начин доставка" strong>
                    {part.shipMethod || "—"}
                  </InfoLine>
                  <InfoLine label="Проследяване">
                    {part.tracking || "—"}
                  </InfoLine>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
