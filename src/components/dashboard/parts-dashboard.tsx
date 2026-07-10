"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { cancelRpAction } from "@/app/actions/rp";
import {
  annaReadyAction,
  annaRevertReadyAction,
  revertRpAction,
  saveShipInfoAction,
  shipRpAction,
  updateDueDateAction,
  updateWorkshopNoteAction,
} from "@/app/actions/rp-mutations";
import { Button, Card, Input } from "@/components/ui";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import type { DashboardPartCard, PartsViewType } from "@/lib/domain/dashboard-parts";
import type { ViewerContext } from "@/lib/viewer-context";

const TABS: { id: PartsViewType; label: string }[] = [
  { id: "active", label: "Активни" },
  { id: "ready", label: "Готови" },
  { id: "archive", label: "Изпратени" },
  { id: "cancelled", label: "Отказани" },
];

export function PartsDashboard({
  viewer,
  initialParts,
  initialView = "active",
  title = "Dashboard",
  regionalScope,
}: {
  viewer: ViewerContext;
  initialParts: DashboardPartCard[];
  initialView?: PartsViewType;
  title?: string;
  regionalScope?: string;
}) {
  const router = useRouter();
  const view = initialView;
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  useDashboardRefresh();

  const parts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialParts;
    return initialParts.filter((part) =>
      [part.rpNum, part.client, part.market, part.itemType, part.partDescription]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [initialParts, search]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function dashboardHref(nextView: PartsViewType, scope?: string) {
    const params = new URLSearchParams();
    params.set("view", nextView);
    if (scope) params.set("scope", scope);
    return `/dashboard?${params.toString()}`;
  }

  async function run(action: () => Promise<{ error?: string }>) {
    const result = await action();
    if (result.error) alert(result.error);
    else refresh();
  }

  const showReadyTab = Boolean(viewer.reviewerConfig);
  const canEditWorkshop = Boolean(viewer.reviewerConfig);
  const isAnna = viewer.effectiveEmail === "anna@meavo.com";
  const scopes = viewer.regionalScopes;
  const activeScope = regionalScope ?? scopes[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {title}
          </h1>
          <p className="text-sm text-slate-600">
            Viewing as <strong>{viewer.effectiveEmail}</strong>
          </p>
        </div>
        <Link
          href="/log"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Нов RP
        </Link>
      </div>

      {scopes.length > 1 ? (
        <nav className="flex flex-wrap gap-1">
          {scopes.map((scope) => (
            <Link
              key={scope}
              href={dashboardHref(view, scope)}
              className={`rounded-md px-3 py-1 text-xs ${
                activeScope === scope
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {scope.replace(/_/g, " ")}
            </Link>
          ))}
        </nav>
      ) : null}

      <nav className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.filter((tab) => tab.id !== "ready" || showReadyTab).map((tab) => (
          <Link
            key={tab.id}
            href={dashboardHref(tab.id, activeScope)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === tab.id
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Търсене RP, клиент, пазар…"
      />

      {pending ? <p className="text-sm text-slate-500">Обновяване…</p> : null}

      {parts.length === 0 ? (
        <p className="text-sm text-slate-500">Няма записи в този изглед.</p>
      ) : null}

      <div className="grid gap-3">
        {parts.map((part) => (
          <Card key={part.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {part.rpNum}
                  {part.urgency === "urgent" ? (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Спешно
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm text-slate-600">
                  {part.itemType} · {part.market} · {part.status || "Active"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {part.canEditRp ? (
                  <Link
                    href={`/log?editRp=${encodeURIComponent(part.rpNum)}`}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                  >
                    Редакция
                  </Link>
                ) : null}
                <Link
                  href={`/log?similarRp=${encodeURIComponent(part.rpNum)}`}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                >
                  Подобен RP
                </Link>
                {view === "active" &&
                part.userId === viewer.effectiveEmail ? (
                  <Button
                    variant="danger"
                    className="px-3 py-1"
                    onClick={() =>
                      void run(() => cancelRpAction(part.rpNum))
                    }
                  >
                    Отказ
                  </Button>
                ) : null}
                {isAnna && view === "active" ? (
                  <Button
                    className="px-3 py-1"
                    onClick={() => void run(() => annaReadyAction(part.rpNum))}
                  >
                    Готов за логистика
                  </Button>
                ) : null}
                {isAnna && view === "ready" ? (
                  <Button
                    variant="secondary"
                    className="px-3 py-1"
                    onClick={() =>
                      void run(() => annaRevertReadyAction(part.rpNum))
                    }
                  >
                    Върни в активни
                  </Button>
                ) : null}
                {part.userId === viewer.effectiveEmail && view === "archive" ? (
                  <Button
                    variant="secondary"
                    className="px-3 py-1"
                    onClick={() => void run(() => revertRpAction(part.rpNum))}
                  >
                    Върни активен
                  </Button>
                ) : null}
              </div>
            </div>
            <dl className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Клиент</dt>
                <dd>{part.client || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Срок</dt>
                <dd>{part.dueDate || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Модел / Партида</dt>
                <dd>
                  {part.model || "—"} / {part.boothId || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Описание</dt>
                <dd>{part.partDescription || part.itemType || "—"}</dd>
              </div>
              {part.shipMethod ? (
                <div>
                  <dt className="text-slate-500">Доставка</dt>
                  <dd>
                    {part.shipMethod} {part.tracking ? `· ${part.tracking}` : ""}
                  </dd>
                </div>
              ) : null}
              {canEditWorkshop ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Бележка цех</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    <span>{part.workshopNote || "—"}</span>
                    <Button
                      variant="secondary"
                      className="px-2 py-0.5 text-xs"
                      onClick={() => {
                        const note = prompt("Бележка цех", part.workshopNote ?? "");
                        if (note === null) return;
                        void run(() =>
                          updateWorkshopNoteAction("rp", part.rpNum, note),
                        );
                      }}
                    >
                      Редакция
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-2 py-0.5 text-xs"
                      onClick={() => {
                        const newDate = prompt("Нов срок (YYYY-MM-DD)", part.dueDate ?? "");
                        if (!newDate) return;
                        const reason = prompt("Причина за промяна") ?? "";
                        void run(() =>
                          updateDueDateAction("rp", part.rpNum, newDate, reason),
                        );
                      }}
                    >
                      Срок
                    </Button>
                  </dd>
                </div>
              ) : null}
            </dl>
            {view === "ready" && isAnna ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  className="px-3 py-1 text-xs"
                  onClick={() =>
                    void run(() =>
                      shipRpAction(part.rpNum, part.shipMethod ?? "Pallet", part.tracking ?? ""),
                    )
                  }
                >
                  Маркирай изпратен
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-1 text-xs"
                  onClick={() => {
                    const method = prompt("Ship method", part.shipMethod ?? "");
                    const tracking = prompt("Tracking", part.tracking ?? "");
                    if (method === null) return;
                    void run(() =>
                      saveShipInfoAction(part.rpNum, method, tracking ?? ""),
                    );
                  }}
                >
                  Запази доставка
                </Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
