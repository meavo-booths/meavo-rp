"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  briefUrgentPanelAction,
  markUrgentReadyAction,
  updateUrgentEtaAction,
} from "@/app/actions/rp-mutations";
import { Button, Card } from "@/components/ui";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";
import type { UrgentPanelView } from "@/lib/domain/dashboard-urgent";
import type { ViewerContext } from "@/lib/viewer-context";

const TABS: { id: UrgentPanelView; label: string }[] = [
  { id: "unbriefed", label: "Небрифирани" },
  { id: "in_production", label: "В производство" },
  { id: "ready", label: "Готови" },
  { id: "shipped", label: "Изпратени" },
];

const FACTORIES = ["AKS", "VAR", "KAZ"];

export function UrgentPanelsDashboard({
  viewer,
  parts,
  view,
  factory,
}: {
  viewer: ViewerContext;
  parts: DashboardPartCard[];
  view: UrgentPanelView;
  factory?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useDashboardRefresh();

  async function run(action: () => Promise<{ error?: string }>) {
    const result = await action();
    if (result.error) alert(result.error);
    startTransition(() => router.refresh());
  }

  const base = "/dashboard/urgent-panels";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold sm:text-2xl">Спешни панели</h1>
      <nav className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`${base}?view=${tab.id}${factory ? `&factory=${factory}` : ""}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === tab.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2">
        {FACTORIES.map((f) => (
          <Link
            key={f}
            href={`${base}?view=${view}&factory=${f}`}
            className={`rounded-full px-3 py-1 text-xs ${
              factory === f ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>
      {pending ? <p className="text-sm text-slate-500">Обновяване…</p> : null}
      <div className="grid gap-3">
        {parts.map((part) => (
          <Card key={part.id}>
            <h2 className="font-semibold">{part.rpNum}</h2>
            <p className="text-sm text-slate-600">
              {part.reviewGroup} · {part.status} · {part.dueDate}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {view === "unbriefed" ? (
                <Button
                  className="px-3 py-1 text-xs"
                  onClick={() => {
                    const eta = prompt("Production ETA (YYYY-MM-DD)", part.dueDate ?? "");
                    if (!eta) return;
                    void run(() => briefUrgentPanelAction(part.rpNum, eta));
                  }}
                >
                  Brief
                </Button>
              ) : null}
              {view === "in_production" ? (
                <Button
                  variant="secondary"
                  className="px-3 py-1 text-xs"
                  onClick={() => {
                    const eta = prompt("New ETA", part.dueDate ?? "");
                    if (!eta) return;
                    void run(() => updateUrgentEtaAction(part.rpNum, eta));
                  }}
                >
                  Промени ETA
                </Button>
              ) : null}
              {view === "in_production" ? (
                <Button
                  className="px-3 py-1 text-xs"
                  onClick={() => void run(() => markUrgentReadyAction(part.rpNum))}
                >
                  Готов
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
