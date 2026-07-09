import Link from "next/link";
import { redirect } from "next/navigation";

import { LogisticsDashboard } from "@/components/dashboard/logistics-dashboard";
import {
  getLogisticsDashboardParts,
  type LogisticsView,
} from "@/lib/domain/dashboard-logistics";
import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function LogisticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await resolveViewerContext(session.user.email);
  if (viewer.role !== "logistics" && !viewer.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const view = (params.view ?? "processing") as LogisticsView;
  const parts = await getLogisticsDashboardParts(viewer, view);

  return <LogisticsDashboard viewer={viewer} parts={parts} view={view} />;
}
