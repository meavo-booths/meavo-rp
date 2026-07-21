"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { markAdminPanelsSentAction } from "@/app/actions/admin-panels";
import { Button, Card } from "@/components/ui";
import type { AdminPanelRow } from "@/lib/domain/admin-dashboard";

function panelKey(row: AdminPanelRow): string {
  return `${row.recordType}:${row.num}`;
}

export function AdminPanelExportSection({
  factory,
  panels,
}: {
  factory: "KAZ" | "VAR";
  panels: AdminPanelRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(panels.map((p) => panelKey(p))),
  );
  const [busy, setBusy] = useState<"pdf" | "sent" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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

  function numsFromSelection() {
    const rows = selectedRows();
    return {
      rpNums: rows.filter((p) => p.recordType === "rp").map((p) => p.num),
      ipNums: rows.filter((p) => p.recordType === "ip").map((p) => p.num),
    };
  }

  async function downloadPdf() {
    setBusy("pdf");
    setError(null);
    setStatus(null);
    try {
      const { rpNums, ipNums } = numsFromSelection();
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
      const { rpNums, ipNums } = numsFromSelection();
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

      {panels.length === 0 ? (
        <p className="text-sm text-slate-500">No unsent {factory} panels.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="px-2 py-1 text-xs" onClick={selectAll}>
              Select all
            </Button>
            <Button variant="secondary" className="px-2 py-1 text-xs" onClick={deselectAll}>
              Clear
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2"> </th>
                  <th className="px-3 py-2">Num</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Due</th>
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
                          onChange={() => toggle(key)}
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
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy !== null || selected.size === 0}
              onClick={() => void downloadPdf()}
            >
              {busy === "pdf" ? "Generating…" : `Download PDF (${selected.size})`}
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null || selected.size === 0}
              onClick={() => void markSent()}
            >
              {busy === "sent" ? "Saving…" : `Mark as sent (${selected.size})`}
            </Button>
          </div>
        </>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {status ? <p className="text-sm text-brand-700">{status}</p> : null}
    </Card>
  );
}
