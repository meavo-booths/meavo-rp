import { redirect } from "next/navigation";

import { PartsDashboard } from "@/components/dashboard/parts-dashboard";
import { getIvanDashboardParts } from "@/lib/domain/dashboard-parts";
import { parseFilterState } from "@/lib/dashboard-filters";
import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function IvanDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await resolveViewerContext(session.user.email);
  if (viewer.role !== "ivan" && !viewer.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const viewType =
    params.view === "ready"
      ? "ready"
      : params.view === "archive"
        ? "archive"
        : "active";
  const filters = parseFilterState(params);

  const parts = await getIvanDashboardParts(viewer, viewType);

  return (
    <PartsDashboard
      viewer={viewer}
      initialParts={parts}
      initialView={viewType}
      title="Иван — преглед (read-only)"
      basePath="/dashboard/ivan"
      filterCapabilities={{ factory: true, item: true, sort: true }}
      initialFilters={filters}
    />
  );
}
