import { redirect } from "next/navigation";

import { LogisticsDashboard } from "@/components/dashboard/logistics-dashboard";
import {
  getLogisticsDashboardParts,
  type LogisticsView,
} from "@/lib/domain/dashboard-logistics";
import { parseFilterState } from "@/lib/dashboard-filters";
import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function LogisticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await resolveViewerContext(session.user.email);
  if (viewer.role !== "logistics" && !viewer.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const view = (params.view ?? "processing") as LogisticsView;
  const filters = parseFilterState(params);
  const parts = await getLogisticsDashboardParts(viewer, view);

  return (
    <LogisticsDashboard
      viewer={viewer}
      parts={parts}
      view={view}
      initialFilters={filters}
    />
  );
}
