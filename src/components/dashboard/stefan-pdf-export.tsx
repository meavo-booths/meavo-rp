"use client";

import { useEffect, useState } from "react";

import { Button, Card } from "@/components/ui";
import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";
import type { IpDashboardCard } from "@/lib/domain/dashboard-ip";

type PanelEntry = {
  id: string;
  num: string;
  type: "rp" | "ip";
  description: string;
  workshopNote: string | null;
  orderSentAt: string | null;
};

function isPanelItemType(itemType: string | null | undefined): boolean {
  const t = (itemType ?? "").toUpperCase();
  return !["PART", "PARTS", "STOCK", "SPARE"].some((x) => t.includes(x));
}

function rpToEntry(part: DashboardPartCard): PanelEntry {
  return {
    id: part.id,
    num: part.rpNum,
    type: "rp",
    description: part.partDescription || part.itemType || "",
    workshopNote: part.workshopNote,
    orderSentAt: part.orderSentAt,
  };
}

function ipToEntry(card: IpDashboardCard): PanelEntry {
  return {
    id: card.id,
    num: card.ipNum,
    type: "ip",
    description: card.panel || "",
    workshopNote: card.workshopNote,
    orderSentAt: card.orderSentAt,
  };
}

export function StefanPdfExport({
  parts,
  ipCards = [],
}: {
  parts: DashboardPartCard[];
  ipCards?: IpDashboardCard[];
}) {
  const rpPanels = parts.filter((p) => isPanelItemType(p.itemType)).map(rpToEntry);
  const ipPanels = ipCards.map(ipToEntry);
  const allPanels = [...rpPanels, ...ipPanels];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const activeNums = new Set(allPanels.map((p) => p.num));
    setSelected(activeNums);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts.length, ipCards.length]);

  function toggle(num: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allPanels.map((p) => p.num)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const rpNums = allPanels
        .filter((p) => p.type === "rp" && selected.has(p.num))
        .map((p) => p.num);
      const ipNums = allPanels
        .filter((p) => p.type === "ip" && selected.has(p.num))
        .map((p) => p.num);

      const params = new URLSearchParams();
      if (rpNums.length) params.set("rpNums", rpNums.join(","));
      if (ipNums.length) params.set("ipNums", ipNums.join(","));

      const res = await fetch(`/api/stefan/panels-pdf?${params.toString()}`);
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

  if (!allPanels.length) return null;

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">KAZ панели — PDF експорт</h2>
      <p className="text-sm text-slate-600">
        Всички активни панели са маркирани. Махни отметка или добави други по желание.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={selectAll}>
          Избери всички
        </Button>
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={deselectAll}>
          Изчисти
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {allPanels.map((panel) => (
          <label
            key={panel.num}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
              selected.has(panel.num)
                ? "border-brand-600 bg-brand-50"
                : "border-slate-200"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(panel.num)}
              onChange={() => toggle(panel.num)}
              className="mt-1"
            />
            <span>
              <strong>{panel.num}</strong>
              {panel.type === "ip" ? (
                <span className="ml-1 rounded bg-slate-100 px-1 text-xs text-slate-500">IP</span>
              ) : null}
              {panel.orderSentAt ? (
                <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">
                  Sent {panel.orderSentAt}
                </span>
              ) : null}
              {" — "}
              {panel.description}
              <br />
              <span className="text-xs text-slate-500">
                Цех: {panel.workshopNote || "—"}
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
