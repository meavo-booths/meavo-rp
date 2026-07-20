import type { ReactNode } from "react";

import { DashboardInfoLine } from "@/components/dashboard/dashboard-info-line";
import { ItemsList } from "@/components/dashboard/items-list";
import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";
import type { PartsViewType } from "@/lib/domain/dashboard-parts";
import type { DashboardUiLabels } from "@/lib/ui-locale";

function formatDueDate(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return value;
}

function shouldShowModel(model: string | null): boolean {
  return Boolean(model && model.toLowerCase() !== "other");
}

function shouldShowBooth(boothId: string | null, isIp: boolean): boolean {
  if (isIp) return false;
  return Boolean(boothId && boothId.toLowerCase() !== "stock");
}

function shouldShowColor(color: string | null): boolean {
  return Boolean(color && color.toLowerCase() !== "part");
}

export type DashboardPartCardLayout =
  | "standard-active"
  | "standard"
  | "reviewer"
  | "reviewer-no-ship";

export function resolveDashboardPartCardLayout(options: {
  isStandardViewer: boolean;
  view: PartsViewType;
  hideShippingSection: boolean;
  hasActionsColumn: boolean;
}): DashboardPartCardLayout {
  if (options.hasActionsColumn && options.hideShippingSection) {
    return "reviewer-no-ship";
  }
  if (options.hasActionsColumn) return "reviewer";
  if (options.isStandardViewer && options.view === "active") {
    return "standard-active";
  }
  return "standard";
}

function gridColsForLayout(layout: DashboardPartCardLayout): string {
  switch (layout) {
    case "standard-active":
      return "lg:grid-cols-[minmax(9.5rem,16%)_minmax(0,56%)_minmax(0,32%)]";
    case "standard":
      return "lg:grid-cols-[minmax(9.5rem,16%)_minmax(0,48%)_minmax(0,34%)]";
    case "reviewer":
      return "lg:grid-cols-[minmax(9.5rem,16%)_minmax(0,26%)_minmax(0,41%)_minmax(8.5rem,17%)]";
    case "reviewer-no-ship":
      return "lg:grid-cols-[minmax(9.5rem,16%)_minmax(0,48%)_minmax(8.5rem,28%)]";
  }
}

export function DashboardPartCardView({
  part,
  labels,
  view,
  layout,
  isIp,
  hideShippingSection,
  dueInTechColumn,
  showWorkshopNote,
  showStatusBadge,
  techBottom,
  workshopNoteFooter,
  dueDateFooter,
  actionsColumn,
  shippingFooter,
}: {
  part: DashboardPartCard;
  labels: DashboardUiLabels;
  view: PartsViewType;
  layout: DashboardPartCardLayout;
  isIp: boolean;
  hideShippingSection: boolean;
  dueInTechColumn: boolean;
  showWorkshopNote: boolean;
  showStatusBadge: boolean;
  techBottom?: ReactNode;
  workshopNoteFooter?: ReactNode;
  dueDateFooter?: ReactNode;
  actionsColumn?: ReactNode;
  shippingFooter?: ReactNode;
}) {
  const isUrgent = part.urgency === "urgent";
  const isArchive = view === "archive";
  const isCancelled = view === "cancelled";
  const showModel = shouldShowModel(part.model);
  const showBooth = shouldShowBooth(part.boothId, isIp);
  const showColor = shouldShowColor(part.color);
  const dueFallback = labels.locale === "bg" ? "---" : "TBC";
  const dueLabel = formatDueDate(part.dueDate, dueFallback);

  const dueBadge = (
    <span className="inline-block rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-[0.9rem] font-semibold tracking-wide text-white">
      {dueLabel}
    </span>
  );

  const dueSection = (
    <div className="flex flex-wrap items-center gap-2">
      {dueBadge}
      {dueDateFooter}
    </div>
  );

  const workshopNoteSection =
    showWorkshopNote ? (
      <div className="space-y-1">
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-500">
          {labels.cardWorkshopNote}
        </p>
        <p className="text-sm text-slate-800">{part.workshopNote || "—"}</p>
        {workshopNoteFooter}
      </div>
    ) : null;

  const archiveShippingMeta =
    isArchive && !isIp && part.shipMethod ? (
      <div className="mt-2 space-y-0.5">
        <DashboardInfoLine label={labels.cardShipping} strong>
          {part.shipMethod}
        </DashboardInfoLine>
        {part.tracking ? (
          <DashboardInfoLine label={labels.cardTracking} strong>
            {part.tracking}
          </DashboardInfoLine>
        ) : null}
      </div>
    ) : null;

  const gridCols = gridColsForLayout(layout);

  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-sm sm:p-4 ${
        isUrgent
          ? "border-l-[5px] border-l-amber-500 border-slate-200 bg-gradient-to-r from-amber-50/80 to-white"
          : isCancelled
            ? "border-l-[5px] border-l-slate-300 border-slate-200 bg-gradient-to-r from-rose-50/50 to-white"
            : isArchive
              ? "border-l-[5px] border-l-slate-300 border-slate-200 bg-gradient-to-r from-sky-50/50 to-white"
              : "border-l-[5px] border-l-slate-300 border-slate-200 bg-gradient-to-r from-sky-50/40 to-white"
      }`}
    >
      <div className={`grid items-stretch gap-0 ${gridCols}`}>
        <div className="flex min-h-0 min-w-0 flex-col border-b border-slate-200 pb-3 lg:min-h-[11rem] lg:border-b-0 lg:border-r lg:pb-0 lg:pr-3">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[1.85rem] font-extrabold leading-none tracking-tight text-slate-900 sm:text-[2rem]">
                  {part.rpNum}
                </h2>
                {isIp || isUrgent ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {isIp ? (
                      <span className="rounded bg-sky-100 px-2 py-0.5 text-[0.7rem] font-bold text-sky-900">
                        {labels.cardIpTag}
                      </span>
                    ) : null}
                    {isUrgent ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[0.7rem] font-bold text-amber-900">
                        {labels.cardUrgentTag}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {showStatusBadge && part.status ? (
                <span className="shrink-0 rounded bg-slate-500 px-2 py-0.5 text-[0.7rem] font-semibold text-white">
                  {part.status}
                </span>
              ) : null}
            </div>

            {isIp ? (
              <div className="mt-3.5 space-y-0.5">
                <DashboardInfoLine label={labels.cardDescription}>
                  {part.itemType ?? "—"}
                </DashboardInfoLine>
                <DashboardInfoLine label={labels.factoryLabel} strong>
                  {part.reviewGroup ?? "—"}
                </DashboardInfoLine>
                <DashboardInfoLine label="Status" strong>
                  {part.status || "Active"}
                </DashboardInfoLine>
              </div>
            ) : showBooth || showModel || showColor ? (
              <div className="mt-3.5 space-y-0.5">
                {showBooth ? (
                  <DashboardInfoLine label={labels.cardBooth} strong>
                    {part.boothId}
                  </DashboardInfoLine>
                ) : null}
                {showModel ? (
                  <DashboardInfoLine label={labels.cardModel}>
                    {part.model}
                  </DashboardInfoLine>
                ) : null}
                {showColor ? (
                  <DashboardInfoLine label={labels.cardColor}>
                    {part.color}
                  </DashboardInfoLine>
                ) : null}
              </div>
            ) : null}

            {archiveShippingMeta}
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-2.5">
            {dueInTechColumn ? dueSection : null}
            {techBottom}
          </div>
        </div>

        <div
          className={`flex min-h-0 min-w-0 flex-col border-b border-slate-200 py-3 lg:min-h-[11rem] lg:py-0 ${
            hideShippingSection ? "" : "lg:border-b-0 lg:border-r lg:px-3"
          }`}
        >
          <div className="min-h-0 flex-1">
            {!isIp ? (
              <p className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-500">
                {labels.cardItems}
              </p>
            ) : null}
            <ItemsList items={part.items} />
            {part.clarifications ? (
              <div className="mt-2">
                <DashboardInfoLine label={labels.cardClarification}>
                  {part.clarifications}
                </DashboardInfoLine>
              </div>
            ) : null}
            {part.notes ? (
              <p className="mt-1.5 block text-sm italic leading-relaxed text-slate-500">
                {part.notes}
              </p>
            ) : null}
          </div>
          <div className="mt-auto flex flex-col gap-2 pt-2.5">
            {workshopNoteSection}
            {!dueInTechColumn ? dueSection : null}
          </div>
        </div>

        {!hideShippingSection ? (
          <div className="flex min-h-0 min-w-0 flex-col border-b border-slate-200 py-3 lg:min-h-[11rem] lg:border-b-0 lg:py-0 lg:pl-1 lg:pr-0.5">
            <div className="space-y-0.5">
              <DashboardInfoLine label={labels.cardRecipient}>
                {part.recipient || "—"}
              </DashboardInfoLine>
              <DashboardInfoLine label={labels.cardMarket} strong>
                {part.market || "—"}
              </DashboardInfoLine>
              <DashboardInfoLine label={labels.cardClient}>
                {part.client || "—"}
              </DashboardInfoLine>
              <DashboardInfoLine label={labels.cardAddress}>
                {part.address || "—"}
              </DashboardInfoLine>
              {part.phone ? (
                <DashboardInfoLine label={labels.cardPhone}>
                  {part.phone}
                </DashboardInfoLine>
              ) : null}
              {part.email ? (
                <DashboardInfoLine label={labels.cardEmail}>
                  {part.email}
                </DashboardInfoLine>
              ) : null}
            </div>
            {shippingFooter ? <div className="mt-auto pt-3">{shippingFooter}</div> : null}
          </div>
        ) : null}

        {actionsColumn ? (
          <div className="flex min-h-0 min-w-0 flex-col pt-3 lg:min-h-[11rem] lg:justify-center lg:pt-0 lg:pl-2">
            <div className="h-full rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              {actionsColumn}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
