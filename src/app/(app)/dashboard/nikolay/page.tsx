import { redirect } from "next/navigation";

import { PartsDashboard } from "@/components/dashboard/parts-dashboard";
import { getDashboardParts } from "@/lib/domain/dashboard-parts";
import {
  getIpDashboardCards,
  mergeRpAndIpCards,
} from "@/lib/domain/dashboard-ip";
import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function NikolayDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; source?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await resolveViewerContext(session.user.email);
  if (viewer.role !== "nikolay" && !viewer.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const view = params.view ?? "active";
  const viewType =
    view === "ready" ? "ready" : view === "archive" ? "archive" : "active";
  const [rpParts, ipCards] = await Promise.all([
    getDashboardParts({ viewer, viewType }),
    getIpDashboardCards({
      factoryTokens: ["AKS"],
      viewType: view,
      sourceFilter: params.source,
    }),
  ]);

  // GAS getNikolayDashboardData: RP + IP in one sorted feed.
  const merged = mergeRpAndIpCards(rpParts, ipCards);

  return (
    <PartsDashboard
      viewer={viewer}
      initialParts={merged}
      initialView={viewType}
      title="Николай — Производство Аксаково"
      basePath="/dashboard/nikolay"
    />
  );
}
