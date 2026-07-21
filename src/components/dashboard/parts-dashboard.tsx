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
  updatePayerAction,
  updateWorkshopNoteAction,
} from "@/app/actions/rp-mutations";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import {
  DashboardPartCardView,
  resolveDashboardPartCardLayout,
} from "@/components/dashboard/dashboard-part-card";
import {
  formatRegionalScopeParam,
  StandardRegionalScopeBar,
} from "@/components/dashboard/standard-regional-scope-bar";
import { pillPrimary, pillSecondary } from "@/components/app-action-bar";
import { Button } from "@/components/ui";
import { useActionLock } from "@/hooks/use-action-lock";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import {
  canEditPayer,
  canEditWorkshopNote,
  canLogIp,
  isWorkshopNoteDashboardViewer,
  normalizeEmail,
} from "@/lib/domain/authz";
import {
  applyDashboardFilters,
  type DashboardFilterCapabilities,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import type { DashboardPartCard, PartsViewType } from "@/lib/domain/dashboard-parts";
import { getStandardRegionalButtonDefs } from "@/lib/domain/standard-regional-scopes";
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
  const dashboardCapabilities = filterCapabilities ?? {};

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

  function hrefForRegionalScopes(scopes: string[]) {
    const param = formatRegionalScopeParam(scopes);
    return dashboardHref(view, param);
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
  const payerEditable = canEditPayer(viewerEmail);
  const showPayerOnCards = payerEditable || Boolean(reviewerConfig);
  const isAnna = viewerEmail === "anna@meavo.com";
  const canCreateSimilar = viewer.role === "standard";
  const isStandardViewer = !reviewerConfig;
  const hideShippingSection = Boolean(reviewerConfig?.hideShippingAddressSection);
  const dueInTechColumn = isWorkshopNoteDashboardViewer(viewerEmail);
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
  const regionalButtonDefs =
    viewer.role === "standard"
      ? getStandardRegionalButtonDefs(viewer.effectiveEmail)
      : [];

  return (
    <div className="space-y-3">
      {/* GAS headerControls row: New Entry + regional + view toggles */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <Link href="/log" className={pillPrimary}>
          {labels.logRp}
        </Link>
        {canLogIp(viewer.sessionEmail) ? (
          <Link href="/log/ip" className={pillSecondary}>
            {labels.logIp}
          </Link>
        ) : null}

        {showNewRpButton ? (
          <Link href="/log" className={pillPrimary}>
            {labels.newRp}
          </Link>
        ) : null}

        {regionalButtonDefs.length > 0 ? (
          <StandardRegionalScopeBar
            defs={regionalButtonDefs}
            activeScopeParam={regionalScope}
            hrefForScopes={hrefForRegionalScopes}
          />
        ) : null}

        <nav
          className="inline-flex flex-wrap items-stretch gap-0.5 rounded-[11px] border border-slate-300 bg-white/80 p-1 shadow-[inset_0_1px_2px_rgba(33,33,33,0.04)] sm:ms-auto"
          role="tablist"
          aria-label="Orders view"
        >
          {tabs
            .filter((tab) => tab.id !== "ready" || showReadyTab)
            .map((tab) => {
              const active = view === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={dashboardHref(tab.id, regionalScope)}
                  role="tab"
                  aria-selected={active}
                  className={`rounded-lg px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                    active
                      ? "bg-brand-600 text-white shadow-[0_2px_10px_rgba(12,143,97,0.35)]"
                      : "text-slate-500 hover:bg-sky-50 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
        </nav>
      </div>

      {hasIpRecords ? (
        <nav className="flex flex-wrap gap-1">
          {sourceFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSourceFilter(filter.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                sourceFilter === filter.id
                  ? "bg-brand-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </nav>
      ) : null}

      <DashboardFilters
        parts={initialParts}
        filters={filters}
        capabilities={dashboardCapabilities}
        labels={labels}
        basePath={`${basePath}?view=${view}`}
        currentQuery=""
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={labels.searchPlaceholder}
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
          const isOwner =
            normalizeEmail(part.userId) ===
            normalizeEmail(viewer.effectiveEmail);
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
          const showStatusBadge =
            isStandardViewer &&
            view === "active" &&
            part.status !== "Shipped" &&
            part.status !== "Cancelled";

          const actionBtnClass = "min-h-[44px] w-full px-3 py-1.5 text-sm";
          const standardActionClass =
            "inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-md border px-2.5 py-1 text-[0.78rem] font-semibold leading-none whitespace-nowrap sm:min-h-[32px]";

          const dueDateFooter =
            canEditDueDate && (view === "active" || view === "ready") ? (
              <Button
                disabled={actionBusy}
                variant="ghost"
                className="px-2 py-0.5 text-xs"
                onClick={() => {
                  const newDate = prompt(
                    labels.promptNewDueDate,
                    part.dueDate ?? "",
                  );
                  if (!newDate) return;
                  const reason = prompt(labels.promptDueDateReason) ?? "";
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
            ) : null;

          const workshopNoteFooter = workshopEditable ? (
            <Button
              disabled={actionBusy}
              variant="secondary"
              className="mt-1 px-2 py-0.5 text-xs"
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
          ) : null;

          const payerFooter =
            !isIp && payerEditable ? (
              <Button
                disabled={actionBusy}
                variant="secondary"
                className="mt-1 px-2 py-0.5 text-xs"
                onClick={() => {
                  const next = prompt(
                    labels.promptPayer,
                    part.payer ?? "",
                  );
                  if (next === null) return;
                  void run(() => updatePayerAction(part.rpNum, next));
                }}
              >
                {labels.cardEdit}
              </Button>
            ) : null;

          const standardTechBottom =
            isStandardViewer && isOwner ? (
              <div>
                {view === "active" && !isIp ? (
                  <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
                    {part.canEditRp ? (
                      <Link
                        href={`/log?editRp=${encodeURIComponent(part.rpNum)}`}
                        className={`${standardActionClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                      >
                        {labels.cardEdit}
                      </Link>
                    ) : (
                      <span
                        title={part.editRpDisabledReason || "Edit unavailable"}
                        className={`${standardActionClass} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400`}
                      >
                        {labels.cardEdit}
                      </span>
                    )}
                    {canCreateSimilar ? (
                      <Link
                        href={`/log?similarRp=${encodeURIComponent(part.rpNum)}`}
                        className={`${standardActionClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                      >
                        {labels.cardCreateSimilar}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      disabled={actionBusy}
                      className={`${standardActionClass} border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 disabled:opacity-50`}
                      onClick={() => void run(() => cancelRpAction(part.rpNum))}
                    >
                      {labels.cardCancel}
                    </button>
                  </div>
                ) : null}
                {(view === "archive" || view === "cancelled") && !isIp ? (
                  <Button
                    disabled={actionBusy}
                    variant="secondary"
                    className="min-h-[44px] w-full px-3 py-2.5 text-sm font-bold"
                    onClick={() => void run(() => revertRpAction(part.rpNum))}
                  >
                    {labels.cardBringBack}
                  </Button>
                ) : null}
              </div>
            ) : null;

          const reviewerActions = !isStandardViewer ? (
            <div className="flex h-full flex-col gap-2">
              {!isIp && part.canEditRp ? (
                <Link
                  href={`/log?editRp=${encodeURIComponent(part.rpNum)}`}
                  className={`inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${actionBtnClass}`}
                >
                  {labels.cardEdit}
                </Link>
              ) : null}
              {showLogisticsNotify ? (
                <Button
                  disabled={actionBusy}
                  className={actionBtnClass}
                  onClick={() => void run(() => annaReadyAction(part.rpNum))}
                >
                  {labels.cardNotifyLogistics}
                </Button>
              ) : null}
              {isIp && view === "active" && ipReadyAction ? (
                <Button
                  disabled={actionBusy}
                  className={actionBtnClass}
                  onClick={() => void run(() => ipReadyAction(part.rpNum))}
                >
                  {labels.cardIpReady}
                </Button>
              ) : null}
              {!isIp && isAnna && view === "active" ? (
                <Button
                  disabled={actionBusy}
                  className={actionBtnClass}
                  onClick={() => void run(() => annaReadyAction(part.rpNum))}
                >
                  {labels.cardReadyForLogistics}
                </Button>
              ) : null}
              {!isIp && isAnna && view === "ready" ? (
                <>
                  <Button
                    disabled={actionBusy}
                    className={actionBtnClass}
                    onClick={() =>
                      void run(() =>
                        shipRpAction(
                          part.rpNum,
                          part.shipMethod ?? "Pallet",
                          part.tracking ?? "",
                        ),
                      )
                    }
                  >
                    {labels.cardMarkShipped}
                  </Button>
                  <Button
                    disabled={actionBusy}
                    variant="secondary"
                    className={actionBtnClass}
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
                  <Button
                    disabled={actionBusy}
                    variant="secondary"
                    className={actionBtnClass}
                    onClick={() =>
                      void run(() => annaRevertReadyAction(part.rpNum))
                    }
                  >
                    {labels.cardRevertReady}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null;

          const cardLayout = resolveDashboardPartCardLayout({
            isStandardViewer,
            view,
            hideShippingSection,
            hasActionsColumn: !isStandardViewer,
          });

          return (
            <DashboardPartCardView
              key={part.id}
              part={part}
              labels={labels}
              view={view}
              layout={cardLayout}
              isIp={isIp}
              hideShippingSection={hideShippingSection}
              dueInTechColumn={dueInTechColumn}
              showWorkshopNote={workshopEditable}
              showPayer={showPayerOnCards && !isIp}
              showStatusBadge={showStatusBadge}
              techBottom={standardTechBottom}
              workshopNoteFooter={workshopNoteFooter}
              payerFooter={payerFooter}
              dueDateFooter={dueDateFooter}
              actionsColumn={reviewerActions}
            />
          );
        })}
      </div>
    </div>
  );
}
