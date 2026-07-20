"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { cancelRpAction } from "@/app/actions/rp";
import {
  annaReadyAction,
  annaRevertReadyAction,
  nikolayIpReadyAction,
  revertRpAction,
  saveShipInfoAction,
  shipRpAction,
  stefanIpReadyAction,
  updateDueDateAction,
  updateWorkshopNoteAction,
} from "@/app/actions/rp-mutations";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { Button, Card, Input } from "@/components/ui";
import { useActionLock } from "@/hooks/use-action-lock";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import { canEditWorkshopNote } from "@/lib/domain/authz";
import {
  applyDashboardFilters,
  type DashboardFilterCapabilities,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import type { DashboardPartCard, PartsViewType } from "@/lib/domain/dashboard-parts";
import {
  getDashboardUiLabels,
  type DashboardUiLabels,
} from "@/lib/ui-locale";
import type { ViewerContext } from "@/lib/viewer-context";

function isPartLikeItemType(itemType: string | null): boolean {
  const t = (itemType ?? "").trim().toUpperCase();
  return ["PART", "PARTS", "STOCK", "SPARE"].some((token) => t.includes(token));
}

export function PartsDashboard({
  viewer,
  initialParts,
  initialView = "active",
  title = "Dashboard",
  regionalScope,
  basePath = "/dashboard",
  filterCapabilities,
  initialFilters,
  labels: labelsProp,
  showNewRpButton = false,
}: {
  viewer: ViewerContext;
  initialParts: DashboardPartCard[];
  initialView?: PartsViewType;
  title?: string;
  regionalScope?: string;
  basePath?: string;
  filterCapabilities?: DashboardFilterCapabilities;
  initialFilters?: DashboardFilterState;
  labels?: DashboardUiLabels;
  showNewRpButton?: boolean;
}) {
  const labels = labelsProp ?? getDashboardUiLabels(viewer.role);
  const tabs: { id: PartsViewType; label: string }[] = [
    { id: "active", label: labels.tabActive },
    { id: "ready", label: labels.tabReady },
    { id: "archive", label: labels.tabArchive },
    { id: "cancelled", label: labels.tabCancelled },
  ];
  const sourceFilters: { id: "all" | "rp" | "ip"; label: string }[] = [
    { id: "all", label: labels.sourceAll },
    { id: "rp", label: labels.sourceRp },
    { id: "ip", label: labels.sourceIp },
  ];

  const router = useRouter();
  const view = initialView;
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "rp" | "ip">("all");
  const [pending, startTransition] = useTransition();
  const { busy: actionBusy, runLocked } = useActionLock();
  useDashboardRefresh();

  const filters = initialFilters ?? {
    market: "all",
    factory: "all",
    source: "all",
    item: "all",
    sort: "newest" as const,
  };

  const hasIpRecords = useMemo(
    () => initialParts.some((part) => part.recordType === "ip"),
    [initialParts],
  );

  const parts = useMemo(() => {
    let list = initialParts;
    if (filterCapabilities) {
      list = applyDashboardFilters(
        list,
        filters,
        filterCapabilities,
        search,
      );
    } else {
      const q = search.trim().toLowerCase();
      if (q) {
        list = list.filter((part) =>
          [part.rpNum, part.client, part.market, part.itemType, part.partDescription]
            .join(" ")
            .toLowerCase()
            .includes(q),
        );
      }
    }
    if (sourceFilter !== "all") {
      list = list.filter((part) => part.recordType === sourceFilter);
    }
    return list;
  }, [initialParts, search, sourceFilter, filters, filterCapabilities]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function dashboardHref(nextView: PartsViewType, scope?: string) {
    const params = new URLSearchParams();
    params.set("view", nextView);
    if (scope) params.set("scope", scope);
    if (filters.factory !== "all") params.set("factory", filters.factory);
    if (filters.item !== "all") params.set("item", filters.item);
    if (filters.sort !== "newest") params.set("sort", filters.sort);
    if (filters.source !== "all") params.set("source", filters.source);
    if (filters.market !== "all") params.set("market", filters.market);
    return `${basePath}?${params.toString()}`;
  }

  async function run(action: () => Promise<{ error?: string }>) {
    const result = await runLocked(action);
    if (!result) return;
    if (result.error) alert(result.error);
    else refresh();
  }

  const reviewerConfig = viewer.reviewerConfig;
  const showReadyTab = Boolean(reviewerConfig);
  const canEditDueDate = Boolean(reviewerConfig);
  const viewerEmail = viewer.effectiveEmail;
  const isAnna = viewerEmail === "anna@meavo.com";
  const canCreateSimilar = viewer.role === "standard";
  const logisticsButtonOnly = Boolean(reviewerConfig?.logisticsButtonOnly);
  const panelLogisticsButtonOnly = Boolean(
    reviewerConfig?.panelLogisticsButtonOnly,
  );
  const ipReadyAction =
    viewerEmail === "nikolay@meavo.com"
      ? nikolayIpReadyAction
      : viewerEmail === "stefan@meavo.com"
        ? stefanIpReadyAction
        : null;
  const scopes = viewer.regionalScopes;
  const activeScope = regionalScope ?? scopes[0];

  return (
    <div className="space-y-4">
      {showNewRpButton ? (
        <div className="flex justify-end">
          <Link
            href="/log"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {labels.newRp}
          </Link>
        </div>
      ) : null}

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
        {tabs.filter((tab) => tab.id !== "ready" || showReadyTab).map((tab) => (
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

      {hasIpRecords ? (
        <nav className="flex flex-wrap gap-1">
          {sourceFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSourceFilter(filter.id)}
              className={`rounded-md px-3 py-1 text-xs ${
                sourceFilter === filter.id
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </nav>
      ) : null}

      {filterCapabilities ? (
        <DashboardFilters
          parts={initialParts}
          filters={filters}
          capabilities={filterCapabilities}
          labels={labels}
          basePath={`${basePath}?view=${view}`}
          currentQuery=""
        />
      ) : null}

      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={labels.searchPlaceholder}
      />

      {pending || actionBusy ? (
        <p className="text-sm text-slate-500">{labels.updating}</p>
      ) : null}

      {parts.length === 0 ? (
        <p className="text-sm text-slate-500">{labels.emptyView}</p>
      ) : null}

      <div className="grid gap-3">
        {parts.map((part) => {
          const isIp = part.recordType === "ip";
          const showLogisticsNotify =
            !isIp &&
            view === "active" &&
            (logisticsButtonOnly ||
              (panelLogisticsButtonOnly && !isPartLikeItemType(part.itemType)));
          const workshopEditable = canEditWorkshopNote(
            viewerEmail,
            part.reviewGroup,
            part.itemType,
          );
          return (
          <Card key={part.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {part.rpNum}
                  {isIp ? (
                    <span className="ml-2 rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                      {labels.cardIpTagLong}
                    </span>
                  ) : null}
                  {part.urgency === "urgent" ? (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      {labels.cardUrgentTag}
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm text-slate-600">
                  {isIp
                    ? `${part.itemType ?? "—"} · ${part.reviewGroup ?? "—"} · ${part.status || "Active"}`
                    : `${part.itemType} · ${part.market} · ${part.status || "Active"}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isIp && part.canEditRp ? (
                  <Link
                    href={`/log?editRp=${encodeURIComponent(part.rpNum)}`}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                  >
                    {labels.cardEdit}
                  </Link>
                ) : null}
                {!isIp && canCreateSimilar ? (
                  <Link
                    href={`/log?similarRp=${encodeURIComponent(part.rpNum)}`}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                  >
                    {labels.cardCreateSimilar}
                  </Link>
                ) : null}
                {!isIp &&
                view === "active" &&
                part.userId === viewer.effectiveEmail ? (
                  <Button
                    disabled={actionBusy}
                    variant="danger"
                    className="px-3 py-1"
                    onClick={() =>
                      void run(() => cancelRpAction(part.rpNum))
                    }
                  >
                    {labels.cardCancel}
                  </Button>
                ) : null}
                {showLogisticsNotify ? (
                  <Button
                    disabled={actionBusy}
                    className="px-3 py-1"
                    onClick={() => void run(() => annaReadyAction(part.rpNum))}
                  >
                    {labels.cardNotifyLogistics}
                  </Button>
                ) : null}
                {isIp && view === "active" && ipReadyAction ? (
                  <Button
                    disabled={actionBusy}
                    className="px-3 py-1"
                    onClick={() => void run(() => ipReadyAction(part.rpNum))}
                  >
                    {labels.cardIpReady}
                  </Button>
                ) : null}
                {!isIp && isAnna && view === "active" ? (
                  <Button
                    disabled={actionBusy}
                    className="px-3 py-1"
                    onClick={() => void run(() => annaReadyAction(part.rpNum))}
                  >
                    {labels.cardReadyForLogistics}
                  </Button>
                ) : null}
                {!isIp && isAnna && view === "ready" ? (
                  <Button
                    disabled={actionBusy}
                    variant="secondary"
                    className="px-3 py-1"
                    onClick={() =>
                      void run(() => annaRevertReadyAction(part.rpNum))
                    }
                  >
                    {labels.cardRevertReady}
                  </Button>
                ) : null}
                {!isIp &&
                part.userId === viewer.effectiveEmail &&
                view === "archive" ? (
                  <Button
                    disabled={actionBusy}
                    variant="secondary"
                    className="px-3 py-1"
                    onClick={() => void run(() => revertRpAction(part.rpNum))}
                  >
                    {labels.cardBringBack}
                  </Button>
                ) : null}
              </div>
            </div>
            <dl className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">{labels.cardClient}</dt>
                <dd>{part.client || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{labels.cardDueDate}</dt>
                <dd>{part.dueDate || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{labels.cardModelBatch}</dt>
                <dd>
                  {part.model || "—"} / {part.boothId || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{labels.cardDescription}</dt>
                <dd>{part.partDescription || part.itemType || "—"}</dd>
              </div>
              {part.shipMethod ? (
                <div>
                  <dt className="text-slate-500">{labels.cardShipping}</dt>
                  <dd>
                    {part.shipMethod} {part.tracking ? `· ${part.tracking}` : ""}
                  </dd>
                </div>
              ) : null}
              {workshopEditable || canEditDueDate ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">
                    {workshopEditable ? labels.cardWorkshopNote : labels.cardDueDate}
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {workshopEditable ? (
                      <>
                        <span>{part.workshopNote || "—"}</span>
                        <Button
                          disabled={actionBusy}
                          variant="secondary"
                          className="px-2 py-0.5 text-xs"
                          onClick={() => {
                            const note = prompt(
                              labels.promptWorkshopNote,
                              part.workshopNote ?? "",
                            );
                            if (note === null) return;
                            void run(() =>
                              updateWorkshopNoteAction(
                                part.recordType,
                                part.rpNum,
                                note,
                              ),
                            );
                          }}
                        >
                          {labels.cardEdit}
                        </Button>
                      </>
                    ) : null}
                    {canEditDueDate ? (
                      <Button
                        disabled={actionBusy}
                        variant="secondary"
                        className="px-2 py-0.5 text-xs"
                        onClick={() => {
                          const newDate = prompt(
                            labels.promptNewDueDate,
                            part.dueDate ?? "",
                          );
                          if (!newDate) return;
                          const reason =
                            prompt(labels.promptDueDateReason) ?? "";
                          void run(() =>
                            updateDueDateAction(
                              part.recordType,
                              part.rpNum,
                              newDate,
                              reason,
                            ),
                          );
                        }}
                      >
                        {labels.cardChangeDueDate}
                      </Button>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            {!isIp && view === "ready" && isAnna ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={actionBusy}
                  className="px-3 py-1 text-xs"
                  onClick={() =>
                    void run(() =>
                      shipRpAction(part.rpNum, part.shipMethod ?? "Pallet", part.tracking ?? ""),
                    )
                  }
                >
                  {labels.cardMarkShipped}
                </Button>
                <Button
                  disabled={actionBusy}
                  variant="secondary"
                  className="px-3 py-1 text-xs"
                  onClick={() => {
                    const method = prompt(
                      labels.promptShipMethod,
                      part.shipMethod ?? "",
                    );
                    const tracking = prompt(
                      labels.promptTracking,
                      part.tracking ?? "",
                    );
                    if (method === null) return;
                    void run(() =>
                      saveShipInfoAction(part.rpNum, method, tracking ?? ""),
                    );
                  }}
                >
                  {labels.cardSaveShipping}
                </Button>
              </div>
            ) : null}
          </Card>
          );
        })}
      </div>
    </div>
  );
}
