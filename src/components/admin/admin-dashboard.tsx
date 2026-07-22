"use client";

import { AdminPanelExportSection } from "@/components/admin/admin-panel-export";
import { useEntityDetailModal } from "@/components/dashboard/entity-detail-modal";
import { Card } from "@/components/ui";
import type {
  AdminDashboardData,
  AdminDelayedRow,
  AdminIssueRow,
} from "@/lib/domain/admin-dashboard";
import { getDashboardUiLabels } from "@/lib/ui-locale";

function IssuesTable({
  rows,
  onOpen,
  openDetailTitle,
}: {
  rows: AdminIssueRow[];
  onOpen: (rpNum: string) => void;
  openDetailTitle: string;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-slate-500">No panel RPs with missing required data.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">RP</th>
            <th className="px-3 py-2">Factory</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Issues</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.rpNum}
              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              onClick={() => onOpen(row.rpNum)}
              title={openDetailTitle}
            >
              <td className="px-3 py-2 font-medium text-brand-700 underline-offset-2 hover:underline">
                {row.rpNum}
              </td>
              <td className="px-3 py-2">{row.reviewGroup ?? "—"}</td>
              <td className="px-3 py-2">{row.dueDate ?? "—"}</td>
              <td className="px-3 py-2">{row.status ?? "—"}</td>
              <td className="px-3 py-2">
                <ul className="flex flex-wrap gap-1">
                  {row.issues.map((issue) => (
                    <li
                      key={issue}
                      className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900"
                    >
                      {issue}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DelayedTable({
  rows,
  onOpen,
  openDetailTitle,
}: {
  rows: AdminDelayedRow[];
  onOpen: (recordType: "rp" | "ip", num: string) => void;
  openDetailTitle: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No overdue RPs or IPs.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Num</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Factory</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Overdue by</th>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.recordType}:${row.rpNum}`}
              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              onClick={() => onOpen(row.recordType, row.rpNum)}
              title={openDetailTitle}
            >
              <td className="px-3 py-2 font-medium text-brand-700 underline-offset-2 hover:underline">
                {row.rpNum}
              </td>
              <td className="px-3 py-2 uppercase text-slate-500">{row.recordType}</td>
              <td className="px-3 py-2">{row.reviewGroup ?? "—"}</td>
              <td className="px-3 py-2">{row.dueDate ?? "—"}</td>
              <td className="px-3 py-2 font-medium text-amber-700">
                {row.overdueDays} day{row.overdueDays === 1 ? "" : "s"}
              </td>
              <td className="px-3 py-2">{row.itemType ?? "—"}</td>
              <td className="px-3 py-2 text-slate-600">{row.notes?.trim() || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const labels = getDashboardUiLabels("admin");
  const { openDetail, modal, openDetailTitle } = useEntityDetailModal(labels);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Missing required data</h2>
        <p className="text-sm text-slate-600">
          Active panel RPs without factory, due date, or workshop note (KAZ/VAR).
        </p>
        <IssuesTable
          rows={data.issues}
          openDetailTitle={openDetailTitle}
          onOpen={(rpNum) => openDetail("rp", rpNum)}
        />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Overdue</h2>
        <p className="text-sm text-slate-600">
          RPs and IPs whose deadline date has already passed, sorted by most overdue first.
        </p>
        <DelayedTable
          rows={data.delayed}
          openDetailTitle={openDetailTitle}
          onOpen={(recordType, num) => openDetail(recordType, num)}
        />
      </Card>

      <AdminPanelExportSection
        factory="KAZ"
        panels={data.unsentKaz}
        recentPanels={data.recentKaz}
      />
      <AdminPanelExportSection
        factory="VAR"
        panels={data.unsentVar}
        recentPanels={data.recentVar}
      />
      {modal}
    </div>
  );
}
