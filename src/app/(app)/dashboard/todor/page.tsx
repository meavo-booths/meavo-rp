import Link from "next/link";
import { redirect } from "next/navigation";

import { RoleIpDashboard } from "@/components/dashboard/role-ip-dashboard";
import { Card } from "@/components/ui";
import {
  getTodorExportRpRows,
  getTodorTopoliIpCards,
} from "@/lib/domain/dashboard-todor";
import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function TodorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string; week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await resolveViewerContext(session.user.email);
  if (viewer.role !== "todor" && !viewer.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const sub = params.sub ?? "export";
  const week = params.week === "next" ? "next" : "this";

  const ipCards =
    sub === "topoli"
      ? await getTodorTopoliIpCards()
      : [];
  const exportRows =
    sub === "export" ? await getTodorExportRpRows(week) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Тодор — експорт / Тополи</h1>
      <nav className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/todor?sub=export&week=this"
          className={`rounded-lg px-3 py-1 text-sm ${
            sub === "export" ? "bg-brand-600 text-white" : "bg-slate-100"
          }`}
        >
          Износ (тази седмица)
        </Link>
        <Link
          href="/dashboard/todor?sub=export&week=next"
          className={`rounded-lg px-3 py-1 text-sm ${
            sub === "export" && week === "next"
              ? "bg-brand-600 text-white"
              : "bg-slate-100"
          }`}
        >
          Износ (следваща)
        </Link>
        <Link
          href="/dashboard/todor?sub=topoli"
          className={`rounded-lg px-3 py-1 text-sm ${
            sub === "topoli" ? "bg-brand-600 text-white" : "bg-slate-100"
          }`}
        >
          Наличност Тополи
        </Link>
      </nav>

      {sub === "export" ? (
        <div className="grid gap-3">
          {exportRows.map((row) => (
            <Card key={row.rpNum}>
              <h2 className="font-semibold">{row.rpNum}</h2>
              <p className="text-sm text-slate-600">
                {row.reviewGroup} · {row.market} · {row.status}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <RoleIpDashboard
          title="Topoli warehouse IP"
          cards={ipCards.map((c) => ({
            id: c.ipNum,
            ipNum: c.ipNum,
            recordType: "ip" as const,
            due: null,
            user: null,
            issue: null,
            priority: "standard",
            model: null,
            panel: c.panel,
            batch: c.batch,
            color: null,
            warehouse: c.warehouse,
            factory: c.factory,
            sourceRp: null,
            clarification: null,
            note: null,
            workshopNote: null,
            status: c.status,
            tracking: null,
          }))}
          role="todor"
        />
      )}
    </div>
  );
}
