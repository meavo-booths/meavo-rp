import { AdminPanelExportSection } from "@/components/admin/admin-panel-export";
import { Card } from "@/components/ui";
import type {
  AdminDashboardData,
  AdminDelayedRow,
  AdminIssueRow,
} from "@/lib/domain/admin-dashboard";

function IssuesTable({ rows }: { rows: AdminIssueRow[] }) {
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
            <tr key={row.rpNum} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">{row.rpNum}</td>
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

function DelayedTable({ rows }: { rows: AdminDelayedRow[] }) {
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
            <tr key={`${row.recordType}:${row.rpNum}`} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">{row.rpNum}</td>
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
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Missing required data</h2>
        <p className="text-sm text-slate-600">
          Active panel RPs without factory, due date, or workshop note (KAZ/VAR).
        </p>
        <IssuesTable rows={data.issues} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Overdue</h2>
        <p className="text-sm text-slate-600">
          RPs and IPs whose deadline date has already passed, sorted by most overdue first.
        </p>
        <DelayedTable rows={data.delayed} />
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
    </div>
  );
}
