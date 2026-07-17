"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  briefUrgentPanelAction,
  markUrgentReadyAction,
  updateUrgentEtaAction,
  useExistingPanelForRpAction,
} from "@/app/actions/rp-mutations";
import { Button, Card } from "@/components/ui";
import { useActionLock } from "@/hooks/use-action-lock";
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
  const { busy: actionBusy, runLocked } = useActionLock();
  useDashboardRefresh();

  async function run(action: () => Promise<{ error?: string }>) {
    const result = await runLocked(action);
    if (!result) return;
    if (result.error) alert(result.error);
    startTransition(() => router.refresh());
  }

  const base = "/dashboard/urgent-panels";

  return (
    <div className="space-y-4">
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
      {pending || actionBusy ? (
        <p className="text-sm text-slate-500">Обновяване…</p>
      ) : null}
      <div className="grid gap-3">
        {parts.map((part) => (
          <Card key={part.id}>
            <h2 className="font-semibold">{part.rpNum}</h2>
            <p className="text-sm text-slate-600">
              {part.reviewGroup} · {part.status} · {part.dueDate}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {view === "unbriefed" ? (
                <>
                <Button
                  className="px-3 py-1 text-xs"
                  disabled={actionBusy}
                  onClick={() => {
                    const eta = prompt("Production ETA (YYYY-MM-DD)", part.dueDate ?? "");
                    if (!eta) return;
                    void run(() => briefUrgentPanelAction(part.rpNum, eta));
                  }}
                >
                  Brief
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-1 text-xs"
                  disabled={actionBusy}
                  onClick={() => {
                    const warehouse = prompt("Warehouse (Topoli / Alliance / NY Warehouse / SF Warehouse)", "Topoli");
                    if (!warehouse) return;
                    const batch = prompt("Batch", part.boothId ?? "") ?? "";
                    const color = prompt("Colour", part.color ?? "") ?? "";
                    void run(() =>
                      useExistingPanelForRpAction(part.rpNum, {
                        batch,
                        color,
                        warehouse,
                      }),
                    );
                  }}
                >
                  Use existing panel
                </Button>
                </>
              ) : null}
              {view === "in_production" ? (
                <Button
                  variant="secondary"
                  className="px-3 py-1 text-xs"
                  disabled={actionBusy}
                  onClick={() => {
                    const eta = prompt("New ETA", part.dueDate ?? "");
                    if (!eta) return;
                    void run(() => updateUrgentEtaAction(part.rpNum, eta));
                  }}
                >
                  Промени ETA
                </Button>
              ) : null}
              {view === "in_production" &&
              (part.status ?? "").trim().toLowerCase() === "in production" ? (
                <Button
                  className="px-3 py-1 text-xs"
                  disabled={actionBusy}
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
