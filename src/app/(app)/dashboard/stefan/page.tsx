import { redirect } from "next/navigation";

import { PartsDashboard } from "@/components/dashboard/parts-dashboard";
import { RoleIpDashboard } from "@/components/dashboard/role-ip-dashboard";
import { StefanPdfExport } from "@/components/dashboard/stefan-pdf-export";
import { getDashboardParts } from "@/lib/domain/dashboard-parts";
import { getIpDashboardCards } from "@/lib/domain/dashboard-ip";
import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function StefanDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await resolveViewerContext(session.user.email);
  if (viewer.role !== "stefan" && !viewer.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const view = params.view ?? "active";
  const viewType =
    view === "ready" ? "ready" : view === "archive" ? "archive" : "active";

  const [rpParts, ipCards] = await Promise.all([
    getDashboardParts({ viewer, viewType }),
    getIpDashboardCards({ factoryTokens: ["KAZ"], viewType: view }),
  ]);

  return (
    <div className="space-y-6">
      <StefanPdfExport parts={rpParts} />
      <PartsDashboard
        viewer={viewer}
        initialParts={rpParts}
        initialView={viewType}
        title="Стефан — KAZ панели (RP)"
      />
      <RoleIpDashboard
        title="Internal Production — KAZ"
        cards={ipCards}
        role="stefan"
      />
    </div>
  );
}
