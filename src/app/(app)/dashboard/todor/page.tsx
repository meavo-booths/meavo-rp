import Link from "next/link";
import { redirect } from "next/navigation";

import { RoleIpDashboard } from "@/components/dashboard/role-ip-dashboard";
import { ClickableEntityCards } from "@/components/dashboard/clickable-entity-cards";
import {
  getTodorDashboardParts,
  getTodorTopoliIpCards,
} from "@/lib/domain/dashboard-todor";
import { auth } from "@/lib/auth";
import { getDashboardUiLabels } from "@/lib/ui-locale";
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
  const labels = getDashboardUiLabels(viewer.role);

  const params = await searchParams;
  const sub =
    params.sub === "topoli" || params.sub === "ip" ? params.sub : "export";
  const week = params.week === "next" ? "next" : "this";

  const ipCards = sub === "ip" ? await getTodorTopoliIpCards() : [];
  const rows =
    sub === "export"
      ? await getTodorDashboardParts("iznos", week)
      : sub === "topoli"
        ? await getTodorDashboardParts("availability")
        : [];

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1 text-sm ${
      active ? "bg-brand-600 text-white" : "bg-slate-100"
    }`;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Тодор — експорт / Тополи</h1>
      <nav className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/todor?sub=export&week=this"
          className={tabClass(sub === "export" && week === "this")}
        >
          Износ (тази седмица)
        </Link>
        <Link
          href="/dashboard/todor?sub=export&week=next"
          className={tabClass(sub === "export" && week === "next")}
        >
          Износ (следваща)
        </Link>
        <Link
          href="/dashboard/todor?sub=topoli"
          className={tabClass(sub === "topoli")}
        >
          Наличност Тополи
        </Link>
        <Link href="/dashboard/todor?sub=ip" className={tabClass(sub === "ip")}>
          Вътрешна продукция
        </Link>
      </nav>

      {sub === "ip" ? (
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
            orderSentAt: null,
            payer: null,
          }))}
          role="todor"
          showWorkshopNoteEdit={false}
        />
      ) : (
        <ClickableEntityCards
          labels={labels}
          rows={rows.map((row) => ({
            key: `${row.source}-${row.rpNum}`,
            recordType: "rp" as const,
            num: row.rpNum,
            subtitle: [
              row.reviewGroup ?? row.factoryName,
              row.market,
              row.status,
              row.shippingWeekCode,
              row.pallet ? `Палет ${row.pallet}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
      )}
    </div>
  );
}
