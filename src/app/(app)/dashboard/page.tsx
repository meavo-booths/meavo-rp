import { redirect } from "next/navigation";

import { PartsDashboard } from "@/components/dashboard/parts-dashboard";
import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

const PHASE2_ROLES = new Set([
  "nikolay",
  "stefan",
  "logistics",
  "urgent_panels",
  "ivan",
  "todor",
]);

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const viewer = await resolveViewerContext(email);

  if (
    PHASE2_ROLES.has(viewer.role) &&
    viewer.defaultDashboardPath !== "/dashboard"
  ) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Specialized view coming soon</p>
          <p className="mt-1">
            Your role-specific dashboard ({viewer.defaultDashboardPath}) is
            scheduled for Phase 2. Use the standard parts list below for now.
          </p>
        </div>
        <PartsDashboard viewer={viewer} />
      </div>
    );
  }

  return <PartsDashboard viewer={viewer} />;
}
