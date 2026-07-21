"use client";

import { usePathname } from "next/navigation";

import { AppActionBar } from "@/components/app-action-bar";
import type { DashboardUiLabels } from "@/lib/ui-locale";

/**
 * Layout chrome under the shared Meavo nav.
 * On PartsDashboard routes, Log RP lives in the dashboard toolbar (GAS header row),
 * so we skip the duplicate action bar there.
 * Admin simulate lives on /admin/simulate only — not in global chrome.
 */
export function AppLayoutChrome({
  labels,
  sessionEmail,
  isAdmin,
}: {
  labels: Pick<DashboardUiLabels, "logRp" | "logIp">;
  sessionEmail: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname() ?? "";
  const partsDashboardOwnsActions =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/ivan") ||
    pathname.startsWith("/dashboard/nikolay") ||
    pathname.startsWith("/dashboard/stefan") ||
    pathname.startsWith("/dashboard/kalin");

  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <div className="space-y-2">
      {!partsDashboardOwnsActions && !isAdminRoute ? (
        <AppActionBar
          labels={labels}
          sessionEmail={sessionEmail}
          showAdminLink={isAdmin}
        />
      ) : null}
    </div>
  );
}
