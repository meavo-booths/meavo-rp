import { redirect } from "next/navigation";

import { PartsDashboard } from "@/components/dashboard/parts-dashboard";
import { normalizeEmail } from "@/lib/domain/authz";
import { getDashboardParts, type PartsViewType } from "@/lib/domain/dashboard-parts";
import { normalizeRegionalScopeRequest } from "@/lib/domain/standard-regional-scopes";
import { parseFilterState } from "@/lib/dashboard-filters";
import { auth } from "@/lib/auth";
import {
  getDashboardUiLabels,
  ownRpsTitleForEmail,
} from "@/lib/ui-locale";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

const ROLE_REDIRECTS = new Set([
  "nikolay",
  "stefan",
  "logistics",
  "urgent_panels",
  "ivan",
  "todor",
]);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const viewer = await resolveViewerContext(email);
  const params = await searchParams;

  if (
    ROLE_REDIRECTS.has(viewer.role) &&
    viewer.defaultDashboardPath !== "/dashboard" &&
    params.own !== "1"
  ) {
    redirect(viewer.defaultDashboardPath);
  }

  const adminOwn =
    viewer.isAdmin &&
    (params.own === "1" ||
      (!viewer.isSimulating &&
        normalizeEmail(viewer.effectiveEmail) ===
          normalizeEmail(viewer.sessionEmail)));

  const viewType = (params.view ?? "active") as PartsViewType;
  const filters = parseFilterState(params);
  const regionalScope = normalizeRegionalScopeRequest(
    viewer.effectiveEmail,
    params.scope,
  );

  const parts = await getDashboardParts({
    viewer,
    viewType,
    regionalScope: regionalScope || undefined,
    adminOwnLoggedParts: adminOwn,
  });

  const filterCapabilities =
    adminOwn || viewer.role === "standard"
      ? { sort: true as const }
      : viewer.reviewerConfig
        ? { sort: true as const }
        : undefined;

  const labels = getDashboardUiLabels(viewer.role, {
    ownLoggedParts: adminOwn,
  });
  const title = adminOwn
    ? ownRpsTitleForEmail(viewer.effectiveEmail)
    : labels.dashboardTitle;

  return (
    <PartsDashboard
      viewer={viewer}
      initialParts={parts}
      initialView={viewType}
      title={title}
      labels={labels}
      regionalScope={regionalScope || undefined}
      basePath={adminOwn ? "/dashboard?own=1" : "/dashboard"}
      filterCapabilities={filterCapabilities}
      initialFilters={filters}
      showNewRpButton={false}
    />
  );
}
