"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { getEntityDetailAction } from "@/app/actions/entity-detail";
import type { EntityDetail } from "@/lib/domain/entity-detail";
import type { LifecycleEntityType } from "@/lib/domain/lifecycle-events";
import {
  detailEventLabel,
  type DashboardUiLabels,
} from "@/lib/ui-locale";

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

function EntityDetailBody({
  detail,
  labels,
}: {
  detail: EntityDetail;
  labels: DashboardUiLabels;
}) {
  const isIp = detail.recordType === "ip";
  return (
    <div className="space-y-5">
      <section className="grid gap-2 sm:grid-cols-2">
        <DetailRow label={labels.detailStatus} value={detail.status} />
        <DetailRow label={labels.detailUrgency} value={detail.urgency} />
        <DetailRow label={labels.detailLogged} value={formatTs(detail.entryDate)} />
        <DetailRow
          label={labels.cardProductionDeadline}
          value={formatTs(detail.dueDate)}
        />
        <DetailRow label={labels.detailOwner} value={detail.ownerEmail} />
        <DetailRow label={labels.cardMarket} value={detail.market} />
        <DetailRow label={labels.detailIssueType} value={detail.issueType} />
        <DetailRow label={labels.cardModel} value={detail.model} />
        <DetailRow
          label={isIp ? labels.detailBatch : labels.cardBooth}
          value={detail.boothId}
        />
        <DetailRow label={labels.cardColor} value={detail.color} />
        <DetailRow
          label={isIp ? labels.detailPanel : labels.detailItem}
          value={detail.itemType}
        />
        <DetailRow label={labels.detailQuantity} value={detail.quantity} />
        <DetailRow label={labels.detailCode} value={detail.partRpCode} />
        <DetailRow label={labels.cardDescription} value={detail.partDescription} />
        <DetailRow label={labels.cardClarification} value={detail.clarifications} />
        <DetailRow
          label={labels.factoryLabel}
          value={detail.factory ?? detail.reviewGroup}
        />
        <DetailRow label={labels.detailWarehouse} value={detail.warehouse} />
        <DetailRow label={labels.detailSourceRp} value={detail.sourceRpNum} />
        <DetailRow label={labels.cardPayer} value={detail.payer} />
        <DetailRow label={labels.cardShipping} value={detail.shipMethod} />
        <DetailRow label={labels.cardTracking} value={detail.tracking} />
        <DetailRow
          label={labels.detailOrderSent}
          value={formatTs(detail.orderSentAt)}
        />
        <DetailRow
          label={labels.detailReadyAt}
          value={formatTs(detail.readyMarkedAt)}
        />
        <DetailRow label={labels.cardWorkshopNote} value={detail.workshopNote} />
      </section>

      {(detail.client || detail.recipient || detail.address) && (
        <section className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {labels.cardShipping}
          </h4>
          <DetailRow label={labels.cardClient} value={detail.client} />
          <DetailRow label={labels.cardRecipient} value={detail.recipient} />
          <DetailRow label={labels.cardAddress} value={detail.address} />
          <DetailRow label={labels.cardPhone} value={detail.phone} />
          <DetailRow label={labels.cardEmail} value={detail.email} />
        </section>
      )}

      {detail.notes ? (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {labels.cardNotes}
          </h4>
          <p className="mt-1 text-sm text-slate-800">{detail.notes}</p>
        </section>
      ) : null}

      {detail.lineItems.length > 0 ? (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {labels.detailLines}
          </h4>
          <ul className="mt-2 space-y-2">
            {detail.lineItems.map((li) => (
              <li
                key={li.id}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <div className="font-medium text-slate-900">
                  {li.panelName ||
                    li.partDescription ||
                    labels.detailLineFallback.replace(
                      "{n}",
                      String(li.lineIndex + 1),
                    )}
                </div>
                <div className="text-slate-600">
                  {li.kind}
                  {li.quantity ? ` · ${li.quantity}` : ""}
                  {li.fulfillment !== "pending" ? ` · ${li.fulfillment}` : ""}
                </div>
                {li.takenFromStockAt ? (
                  <div className="text-xs text-slate-500">
                    {labels.detailStockTaken}: {formatTs(li.takenFromStockAt)}
                    {li.takenFromStockBy ? ` (${li.takenFromStockBy})` : ""}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.photos.length > 0 ? (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {labels.detailPhotos}
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {detail.photos.map((photo) => (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.label || detail.num}
                  className="h-28 w-full object-cover"
                />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {labels.detailHistory}
        </h4>
        {detail.timeline.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{labels.detailHistoryEmpty}</p>
        ) : (
          <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
            {detail.timeline.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600" />
                <div className="text-sm font-semibold text-slate-900">
                  {detailEventLabel(labels, entry.eventType)}
                  {entry.toStatus ? (
                    <span className="ml-1 font-normal text-slate-600">
                      → {entry.toStatus}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {formatTs(entry.at)}
                  {entry.actorEmail ? ` · ${entry.actorEmail}` : ""}
                  {entry.source === "inferred"
                    ? ` · ${labels.detailInferred}`
                    : ""}
                </div>
                {entry.detail ? (
                  <p className="mt-0.5 text-sm text-slate-700">{entry.detail}</p>
                ) : null}
                {entry.fromStatus && entry.fromStatus !== entry.toStatus ? (
                  <p className="text-xs text-slate-500">
                    {labels.detailFrom} {entry.fromStatus}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function EntityDetailModal({
  recordType,
  recordNum,
  open,
  onClose,
  labels,
}: {
  recordType: LifecycleEntityType | null;
  recordNum: string | null;
  open: boolean;
  onClose: () => void;
  labels: DashboardUiLabels;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !recordType || !recordNum) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    void getEntityDetailAction(recordType, recordNum).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDetail(result.detail ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, recordType, recordNum]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !recordType || !recordNum) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-xl border border-slate-200 bg-white shadow-xl sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 id={titleId} className="text-lg font-semibold text-slate-900">
              {recordNum}
            </h3>
            <p className="text-sm text-slate-500">
              {recordType === "ip"
                ? labels.detailSubtitleIp
                : labels.detailSubtitleRp}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            {labels.detailClose}
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">{labels.detailLoading}</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : detail ? (
            <EntityDetailBody detail={detail} labels={labels} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function useEntityDetailModal(labels: DashboardUiLabels) {
  const [target, setTarget] = useState<{
    recordType: LifecycleEntityType;
    recordNum: string;
  } | null>(null);

  const openDetail = useCallback(
    (recordType: LifecycleEntityType, recordNum: string) => {
      setTarget({ recordType, recordNum });
    },
    [],
  );

  const closeDetail = useCallback(() => setTarget(null), []);

  const modal = (
    <EntityDetailModal
      open={Boolean(target)}
      recordType={target?.recordType ?? null}
      recordNum={target?.recordNum ?? null}
      onClose={closeDetail}
      labels={labels}
    />
  );

  return { openDetail, closeDetail, modal, openDetailTitle: labels.openDetailTitle };
}
