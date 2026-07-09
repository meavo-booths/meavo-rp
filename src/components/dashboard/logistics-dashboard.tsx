"use client";

import Link from "next/link";

import { Card } from "@/components/ui";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";
import type { LogisticsView } from "@/lib/domain/dashboard-logistics";
import type { ViewerContext } from "@/lib/viewer-context";

const TABS: { id: LogisticsView; label: string }[] = [
  { id: "processing", label: "В обработка" },
  { id: "ready", label: "Готови за изпращане" },
  { id: "shipped", label: "Изпратени" },
];

export function LogisticsDashboard({
  viewer,
  parts,
  view,
}: {
  viewer: ViewerContext;
  parts: DashboardPartCard[];
  view: LogisticsView;
}) {
  useDashboardRefresh();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">Логистика</h1>
      <p className="text-sm text-slate-600">Като {viewer.effectiveEmail}</p>
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
      <div className="grid gap-3">
        {parts.map((part) => (
          <Card key={part.id}>
            <h2 className="font-semibold">{part.rpNum}</h2>
            <p className="text-sm text-slate-600">
              {part.itemType} · {part.market} · {part.status}
            </p>
            <p className="mt-1 text-sm">
              {part.shipMethod || "—"} {part.tracking ? `· ${part.tracking}` : ""}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
