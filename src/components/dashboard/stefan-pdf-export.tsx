"use client";

import { useState } from "react";

import { Button, Card } from "@/components/ui";
import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";

export function StefanPdfExport({ parts }: { parts: DashboardPartCard[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelParts = parts.filter((part) => {
    const type = (part.itemType ?? "").toUpperCase();
    return !["PART", "PARTS", "STOCK", "SPARE"].some((x) => type.includes(x));
  });

  function toggle(rpNum: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rpNum)) next.delete(rpNum);
      else next.add(rpNum);
      return next;
    });
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const rpNums = Array.from(selected).join(",");
      const res = await fetch(`/api/stefan/panels-pdf?rpNums=${encodeURIComponent(rpNums)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "PDF export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KAZ-panels-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setBusy(false);
    }
  }

  if (!panelParts.length) return null;

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">KAZ панели — PDF експорт</h2>
      <p className="text-sm text-slate-600">
        Избери панели с попълнена бележка цех и генерирай PDF.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {panelParts.map((part) => (
          <label
            key={part.id}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
              selected.has(part.rpNum)
                ? "border-brand-600 bg-brand-50"
                : "border-slate-200"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(part.rpNum)}
              onChange={() => toggle(part.rpNum)}
              className="mt-1"
            />
            <span>
              <strong>{part.rpNum}</strong> — {part.partDescription || part.itemType}
              <br />
              <span className="text-xs text-slate-500">
                Цех: {part.workshopNote || "—"}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button disabled={busy || selected.size === 0} onClick={() => void download()}>
        {busy ? "Генериране…" : `Изтегли PDF (${selected.size})`}
      </Button>
    </Card>
  );
}
