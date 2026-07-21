"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { getEntityDetailAction } from "@/app/actions/entity-detail";
import type { EntityDetail } from "@/lib/domain/entity-detail";
import type { LifecycleEntityType } from "@/lib/domain/lifecycle-events";

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

function EntityDetailBody({ detail }: { detail: EntityDetail }) {
  const isIp = detail.recordType === "ip";
  return (
    <div className="space-y-5">
      <section className="grid gap-2 sm:grid-cols-2">
        <DetailRow label="Статус" value={detail.status} />
        <DetailRow label="Спешност" value={detail.urgency} />
        <DetailRow label="Логнат" value={formatTs(detail.entryDate)} />
        <DetailRow label="Срок" value={formatTs(detail.dueDate)} />
        <DetailRow label="Собственик" value={detail.ownerEmail} />
        <DetailRow label="Пазар" value={detail.market} />
        <DetailRow label="Тип" value={detail.issueType} />
        <DetailRow label="Модел" value={detail.model} />
        <DetailRow label={isIp ? "Партида" : "Кабина"} value={detail.boothId} />
        <DetailRow label="Цвят" value={detail.color} />
        <DetailRow label={isIp ? "Панел" : "Артикул"} value={detail.itemType} />
        <DetailRow label="Количество" value={detail.quantity} />
        <DetailRow label="Код" value={detail.partRpCode} />
        <DetailRow label="Описание" value={detail.partDescription} />
        <DetailRow label="Уточнения" value={detail.clarifications} />
        <DetailRow label="Завод" value={detail.factory ?? detail.reviewGroup} />
        <DetailRow label="Склад" value={detail.warehouse} />
        <DetailRow label="Източник RP" value={detail.sourceRpNum} />
        <DetailRow label="Платец" value={detail.payer} />
        <DetailRow label="Доставка" value={detail.shipMethod} />
        <DetailRow label="Tracking" value={detail.tracking} />
        <DetailRow label="Поръчка изпратена" value={formatTs(detail.orderSentAt)} />
        <DetailRow label="Ready" value={formatTs(detail.readyMarkedAt)} />
        <DetailRow label="Бележка работилница" value={detail.workshopNote} />
      </section>

      {(detail.client || detail.recipient || detail.address) && (
        <section className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Доставка
          </h4>
          <DetailRow label="Клиент" value={detail.client} />
          <DetailRow label="Получател" value={detail.recipient} />
          <DetailRow label="Адрес" value={detail.address} />
          <DetailRow label="Телефон" value={detail.phone} />
          <DetailRow label="Имейл" value={detail.email} />
        </section>
      )}

      {detail.notes ? (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Бележки
          </h4>
          <p className="mt-1 text-sm text-slate-800">{detail.notes}</p>
        </section>
      ) : null}

      {detail.lineItems.length > 0 ? (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Редове
          </h4>
          <ul className="mt-2 space-y-2">
            {detail.lineItems.map((li) => (
              <li
                key={li.id}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <div className="font-medium text-slate-900">
                  {li.panelName || li.partDescription || `Ред ${li.lineIndex + 1}`}
                </div>
                <div className="text-slate-600">
                  {li.kind}
                  {li.quantity ? ` · ${li.quantity}` : ""}
                  {li.fulfillment !== "pending" ? ` · ${li.fulfillment}` : ""}
                </div>
                {li.takenFromStockAt ? (
                  <div className="text-xs text-slate-500">
                    Склад: {formatTs(li.takenFromStockAt)}
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
            Снимки
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
          История
        </h4>
        {detail.timeline.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Няма записана история.</p>
        ) : (
          <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
            {detail.timeline.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600" />
                <div className="text-sm font-semibold text-slate-900">
                  {entry.label}
                  {entry.toStatus ? (
                    <span className="ml-1 font-normal text-slate-600">
                      → {entry.toStatus}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {formatTs(entry.at)}
                  {entry.actorEmail ? ` · ${entry.actorEmail}` : ""}
                  {entry.source === "inferred" ? " · приблизително" : ""}
                </div>
                {entry.detail ? (
                  <p className="mt-0.5 text-sm text-slate-700">{entry.detail}</p>
                ) : null}
                {entry.fromStatus && entry.fromStatus !== entry.toStatus ? (
                  <p className="text-xs text-slate-500">
                    от {entry.fromStatus}
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
}: {
  recordType: LifecycleEntityType | null;
  recordNum: string | null;
  open: boolean;
  onClose: () => void;
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
              {recordType === "ip" ? "Internal Production" : "Replacement Part"} — детайли и история
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Затвори
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">Зареждане…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : detail ? (
            <EntityDetailBody detail={detail} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function useEntityDetailModal() {
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
    />
  );

  return { openDetail, closeDetail, modal };
}
