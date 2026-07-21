"use client";

import { useEntityDetailModal } from "@/components/dashboard/entity-detail-modal";
import { Card } from "@/components/ui";
import type { LifecycleEntityType } from "@/lib/domain/lifecycle-events";

export function ClickableEntityCards({
  rows,
}: {
  rows: {
    key: string;
    recordType: LifecycleEntityType;
    num: string;
    subtitle: string;
  }[];
}) {
  const { openDetail, modal } = useEntityDetailModal();

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Няма записи за този изглед.</p>;
  }

  return (
    <>
      <div className="grid gap-3">
        {rows.map((row) => (
          <Card
            key={row.key}
            className="cursor-pointer transition hover:border-brand-300 hover:shadow-md"
          >
            <div
              role="button"
              tabIndex={0}
              title="Отвори детайли и история"
              onClick={() => openDetail(row.recordType, row.num)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDetail(row.recordType, row.num);
                }
              }}
            >
              <h2 className="font-semibold">{row.num}</h2>
              <p className="text-sm text-slate-600">{row.subtitle}</p>
            </div>
          </Card>
        ))}
      </div>
      {modal}
    </>
  );
}
