"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { markAdminPanelsSentAction } from "@/app/actions/admin-panels";
import { Button, Card } from "@/components/ui";
import type { AdminPanelRow } from "@/lib/domain/admin-dashboard";

function panelKey(row: AdminPanelRow): string {
  return `${row.recordType}:${row.num}`;
}

async function downloadPanelsPdf(
  factory: "KAZ" | "VAR",
  rows: AdminPanelRow[],
): Promise<void> {
  const rpNums = rows.filter((p) => p.recordType === "rp").map((p) => p.num);
  const ipNums = rows.filter((p) => p.recordType === "ip").map((p) => p.num);
  const params = new URLSearchParams({ factory });
  if (rpNums.length) params.set("rpNums", rpNums.join(","));
  if (ipNums.length) params.set("ipNums", ipNums.join(","));

  const res = await fetch(`/api/admin/panels-pdf?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "PDF export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${factory}-panels-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

function PanelPickTable({
  panels,
  selected,
  onToggle,
  showSent,
}: {
  panels: AdminPanelRow[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  showSent?: boolean;
}) {
  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2"> </th>
            <th className="px-3 py-2">Num</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Due</th>
            {showSent ? <th className="px-3 py-2">Sent</th> : null}
            <th className="px-3 py-2">Workshop note</th>
            <th className="px-3 py-2">Description</th>
          </tr>
        </thead>
        <tbody>
          {panels.map((panel) => {
            const key = panelKey(panel);
            const hasNote = (panel.workshopNote ?? "").trim().length > 0;
            return (
              <tr key={key} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => onToggle(key)}
                  />
                </td>
                <td className="px-3 py-2 font-medium">
                  {panel.num}
                  {panel.recordType === "ip" ? (
                    <span className="ml-1 rounded bg-slate-100 px-1 text-xs text-slate-500">
                      IP
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{panel.status ?? "—"}</td>
                <td className="px-3 py-2">{panel.dueDate ?? "—"}</td>
                {showSent ? (
                  <td className="px-3 py-2">
                    {panel.orderSentAt ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                        {panel.orderSentAt}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                ) : null}
                <td className={`px-3 py-2 ${hasNote ? "" : "text-amber-700"}`}>
                  {panel.workshopNote?.trim() || "Missing"}
                </td>
                <td className="px-3 py-2 text-slate-600">{panel.description}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SelectOtherPanelsModal({
  factory,
  panels,
  open,
  onClose,
  onMarked,
}: {
  factory: "KAZ" | "VAR";
  panels: AdminPanelRow[];
  open: boolean;
  onClose: () => void;
  onMarked: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"pdf" | "sent" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setError(null);
    setBusy(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectedRows(): AdminPanelRow[] {
    return panels.filter((p) => selected.has(panelKey(p)));
  }

  async function downloadPdf() {
    setBusy("pdf");
    setError(null);
    try {
      await downloadPanelsPdf(factory, selectedRows());
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setBusy(null);
    }
  }

  async function markSent() {
    setBusy("sent");
    setError(null);
    try {
      const rows = selectedRows();
      const result = await markAdminPanelsSentAction({
        rpNums: rows.filter((p) => p.recordType === "rp").map((p) => p.num),
        ipNums: rows.filter((p) => p.recordType === "ip").map((p) => p.num),
      });
      if (result.error) throw new Error(result.error);
      onMarked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark as sent failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${factory}-other-panels-title`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3
              id={`${factory}-other-panels-title`}
              className="text-base font-semibold text-slate-900"
            >
              Select other {factory} panels
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Latest 15 {factory} panels. Select any to download a PDF or mark as sent.
            </p>
          </div>
          <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-3">
          {panels.length === 0 ? (
            <p className="text-sm text-slate-500">No recent {factory} panels found.</p>
          ) : (
            <PanelPickTable
              panels={panels}
              selected={selected}
              onToggle={toggle}
              showSent
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={busy !== null || selected.size === 0}
            onClick={() => void downloadPdf()}
          >
            {busy === "pdf"
              ? "Generating PDF…"
              : `Download selected PDF (${selected.size})`}
          </Button>
          <Button
            variant="secondary"
            disabled={busy !== null || selected.size === 0}
            onClick={() => void markSent()}
          >
            {busy === "sent"
              ? "Saving sent status…"
              : `Mark selected as sent (${selected.size})`}
          </Button>
        </div>

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}

export function AdminPanelExportSection({
  factory,
  panels,
  recentPanels,
}: {
  factory: "KAZ" | "VAR";
  panels: AdminPanelRow[];
  recentPanels: AdminPanelRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(panels.map((p) => panelKey(p))),
  );
  const [busy, setBusy] = useState<"pdf" | "sent" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(panels.map((p) => panelKey(p))));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function selectedRows(): AdminPanelRow[] {
    return panels.filter((p) => selected.has(panelKey(p)));
  }

  async function downloadPdf() {
    setBusy("pdf");
    setError(null);
    setStatus(null);
    try {
      await downloadPanelsPdf(factory, selectedRows());
      setStatus("PDF downloaded — panels are not marked as sent automatically.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setBusy(null);
    }
  }

  async function markSent() {
    setBusy("sent");
    setError(null);
    setStatus(null);
    try {
      const { rpNums, ipNums } = {
        rpNums: selectedRows()
          .filter((p) => p.recordType === "rp")
          .map((p) => p.num),
        ipNums: selectedRows()
          .filter((p) => p.recordType === "ip")
          .map((p) => p.num),
      };
      const result = await markAdminPanelsSentAction({ rpNums, ipNums });
      if (result.error) throw new Error(result.error);
      setStatus(`Marked ${result.marked ?? 0} panel(s) as sent.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark as sent failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{factory} — unsent panels</h2>
        <span className="text-sm text-slate-500">{panels.length} total</span>
      </div>
      <p className="text-sm text-slate-600">
        Generate PDF exports or manually mark panels as sent. Export does not mark sent.
      </p>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-900">Selection</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={panels.length === 0}
            onClick={selectAll}
          >
            Select all panels
          </Button>
          <Button variant="secondary" onClick={deselectAll}>
            Clear selection
          </Button>
          <Button variant="secondary" onClick={() => setOtherOpen(true)}>
            Select other panels
          </Button>
        </div>
      </div>

      {panels.length === 0 ? (
        <p className="text-sm text-slate-500">No unsent {factory} panels.</p>
      ) : (
        <PanelPickTable panels={panels} selected={selected} onToggle={toggle} />
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-900">Actions for selected panels</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            disabled={busy !== null || selected.size === 0}
            onClick={() => void downloadPdf()}
          >
            {busy === "pdf"
              ? "Generating PDF…"
              : `Download selected PDF (${selected.size})`}
          </Button>
          <Button
            variant="secondary"
            disabled={busy !== null || selected.size === 0}
            onClick={() => void markSent()}
          >
            {busy === "sent"
              ? "Saving sent status…"
              : `Mark selected as sent (${selected.size})`}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {status ? <p className="text-sm text-brand-700">{status}</p> : null}

      <SelectOtherPanelsModal
        factory={factory}
        panels={recentPanels}
        open={otherOpen}
        onClose={() => setOtherOpen(false)}
        onMarked={() => {
          setStatus("Marked selected panels as sent.");
          router.refresh();
        }}
      />
    </Card>
  );
}
