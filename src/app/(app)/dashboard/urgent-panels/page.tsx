import { redirect } from "next/navigation";

import { UrgentPanelsDashboard } from "@/components/dashboard/urgent-panels-dashboard";
import {
  getUrgentPanelCards,
  type UrgentPanelView,
} from "@/lib/domain/dashboard-urgent";
import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function UrgentPanelsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; factory?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await resolveViewerContext(session.user.email);
  if (viewer.role !== "urgent_panels" && !viewer.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const view = (params.view ?? "unbriefed") as UrgentPanelView;
  const parts = await getUrgentPanelCards(
    viewer,
    view,
    params.factory,
  );

  return (
    <UrgentPanelsDashboard
      viewer={viewer}
      parts={parts}
      view={view}
      factory={params.factory}
    />
  );
}
