import { redirect } from "next/navigation";

import { PartsDashboard } from "@/components/dashboard/parts-dashboard";
import { getDashboardParts, type PartsViewType } from "@/lib/domain/dashboard-parts";
import { auth } from "@/lib/auth";
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
  searchParams: Promise<{ view?: string; scope?: string }>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const viewer = await resolveViewerContext(email);
  const params = await searchParams;

  if (
    ROLE_REDIRECTS.has(viewer.role) &&
    viewer.defaultDashboardPath !== "/dashboard"
  ) {
    redirect(viewer.defaultDashboardPath);
  }

  const viewType = (params.view ?? "active") as PartsViewType;
  const parts = await getDashboardParts({
    viewer,
    viewType,
    regionalScope: params.scope,
    search: undefined,
  });

  return (
    <PartsDashboard
      viewer={viewer}
      initialParts={parts}
      initialView={viewType}
      regionalScope={params.scope}
    />
  );
}
