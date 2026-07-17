import Link from "next/link";
import { redirect } from "next/navigation";

import { PartsDashboard } from "@/components/dashboard/parts-dashboard";
import { UrgentPanelsDashboard } from "@/components/dashboard/urgent-panels-dashboard";
import {
  getKalinAllRpsCards,
  getUrgentPanelCards,
} from "@/lib/domain/dashboard-urgent";
import { getDashboardParts } from "@/lib/domain/dashboard-parts";
import { parseFilterState } from "@/lib/dashboard-filters";
import { auth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/domain/authz";
import {
  getDashboardUiLabels,
  ownRpsTitleForEmail,
} from "@/lib/ui-locale";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function KalinDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await resolveViewerContext(session.user.email);
  if (
    normalizeEmail(viewer.effectiveEmail) !== "kalin@meavo.com" &&
    !viewer.isAdmin
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const mode = params.mode ?? "aup";
  const filters = parseFilterState(params);

  if (mode === "own") {
    const parts = await getDashboardParts({
      viewer: { ...viewer, effectiveEmail: "kalin@meavo.com" },
      viewType: "active",
    });
    return (
      <PartsDashboard
        viewer={viewer}
        initialParts={parts}
        title={ownRpsTitleForEmail("kalin@meavo.com")}
        labels={getDashboardUiLabels(viewer.role, { ownLoggedParts: true })}
        showNewRpButton={false}
      />
    );
  }

  if (mode === "all") {
    const parts = await getKalinAllRpsCards(
      viewer,
      "active",
      filters.factory !== "all" ? filters.factory : undefined,
    );
    return (
      <PartsDashboard
        viewer={viewer}
        initialParts={parts}
        title="Kalin — all RPs"
        labels={getDashboardUiLabels("standard")}
        basePath="/dashboard/kalin?mode=all"
        filterCapabilities={{ factory: true, item: true, sort: true }}
        initialFilters={filters}
        showNewRpButton={false}
      />
    );
  }

  const view = (params.view ?? "unbriefed") as
    | "unbriefed"
    | "in_production"
    | "ready"
    | "shipped";
  const parts = await getUrgentPanelCards(viewer, view, params.factory);

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2">
        <Link href="/dashboard/kalin?mode=aup" className="rounded-lg bg-slate-100 px-3 py-1 text-sm">
          AUP
        </Link>
        <Link href="/dashboard/kalin?mode=all" className="rounded-lg bg-slate-100 px-3 py-1 text-sm">
          All RPs
        </Link>
        <Link href="/dashboard/kalin?mode=own" className="rounded-lg bg-slate-100 px-3 py-1 text-sm">
          Own RPs
        </Link>
      </nav>
      <UrgentPanelsDashboard
        viewer={viewer}
        parts={parts}
        view={view}
        factory={params.factory}
      />
    </div>
  );
}
