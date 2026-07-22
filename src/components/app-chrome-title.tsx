"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { AdminSimulateBar } from "@/components/admin-simulate-bar";
import { AdminHeaderActions } from "@/components/admin/admin-header-actions";
import { AdminNav, adminPillClass } from "@/components/admin/admin-nav";
import { SimulationExitButton } from "@/components/admin/simulation-exit-button";
import { canAccessCatalogue } from "@/lib/domain/authz";
import { appendSimulateParam, SIMULATE_QUERY_PARAM } from "@/lib/simulate-as";
import {
  getDashboardUiLabels,
  ownRpsTitleForEmail,
} from "@/lib/ui-locale";
import type { ViewerContext } from "@/lib/viewer-context";

function titleForPath(
  pathname: string,
  search: URLSearchParams,
  viewer: ViewerContext,
): string {
  const own = search.get("own") === "1";
  const labels = getDashboardUiLabels(viewer.role, {
    ownLoggedParts: own || viewer.role === "standard" || viewer.role === "admin",
  });

  if (pathname.startsWith("/dashboard/nikolay")) {
    return "Николай — Производство Аксаково";
  }
  if (pathname.startsWith("/dashboard/stefan")) {
    return "Стефан — Склад Казанлък";
  }
  if (pathname.startsWith("/dashboard/ivan")) {
    return "Иван — преглед";
  }
  if (pathname.startsWith("/dashboard/todor")) {
    return "Тодор — Склад Тополи";
  }
  if (pathname.startsWith("/dashboard/logistics")) {
    return "Logistics";
  }
  if (pathname.startsWith("/dashboard/urgent-panels")) {
    return "Active Urgent Panels";
  }
  if (pathname.startsWith("/dashboard/kalin")) {
    const mode = search.get("mode") ?? "aup";
    if (mode === "own") return ownRpsTitleForEmail("kalin@meavo.com");
    if (mode === "all") return "Kalin — all RPs";
    return "Active Urgent Panels";
  }
  if (pathname.startsWith("/log/ip")) {
    return labels.logIp;
  }
  if (pathname.startsWith("/log")) {
    return labels.logRp;
  }
  if (pathname.startsWith("/admin/dashboard")) {
    return "Admin dashboard";
  }
  if (pathname.startsWith("/admin/automations")) {
    return "Automations";
  }
  if (pathname.startsWith("/admin/data")) {
    return "Neon data";
  }
  if (pathname.startsWith("/catalogue")) {
    return "Catalogue / MRP maps";
  }

  // Default /dashboard — own RPs for standard + admin
  if (
    own ||
    viewer.role === "standard" ||
    viewer.role === "admin" ||
    !viewer.reviewerConfig
  ) {
    return ownRpsTitleForEmail(viewer.effectiveEmail);
  }

  // Anna / reviewer default dashboard
  if (viewer.role === "reviewer") {
    return "Производство / преглед";
  }

  return labels.dashboardTitle;
}

/**
 * Compact title strip under MeavoNavBar.
 * Admins get Dashboard (left) + inline simulate (center) + actions (right).
 * “Viewing as …” only when an admin is simulating another user.
 */
export function AppChromeTitle({ viewer }: { viewer: ViewerContext }) {
  const pathname = usePathname() ?? "/dashboard";
  const searchParams = useSearchParams();
  const title = titleForPath(pathname, searchParams, viewer);
  const showAdminChrome = viewer.isAdmin && !viewer.isSimulating;
  const showCatalogueLink =
    !showAdminChrome && canAccessCatalogue(viewer.effectiveEmail);
  const as = searchParams.get(SIMULATE_QUERY_PARAM);
  const catalogueHref = appendSimulateParam("/catalogue", as);
  const catalogueActive = pathname.startsWith("/catalogue");
  const labels = getDashboardUiLabels(viewer.role, {
    ownLoggedParts: true,
  });

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-[1720px] grid-cols-1 items-center gap-x-3 gap-y-1.5 px-3 py-1.5 sm:grid-cols-[1fr_auto_1fr] sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-sm font-semibold text-slate-900 sm:text-[0.95rem]">
            {title}
          </h1>
          {showAdminChrome ? <AdminNav /> : null}
          {showCatalogueLink ? (
            <Link href={catalogueHref} className={adminPillClass(catalogueActive)}>
              Catalogue
            </Link>
          ) : null}
          {viewer.isSimulating ? (
            <p className="text-xs font-medium text-brand-700 sm:text-sm">
              {labels.viewingAs}{" "}
              <strong className="font-semibold">{viewer.effectiveEmail}</strong>
            </p>
          ) : null}
        </div>

        {showAdminChrome ? (
          <div className="justify-self-stretch sm:justify-self-center">
            <AdminSimulateBar />
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}

        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
          {showAdminChrome ? <AdminHeaderActions /> : null}
          {viewer.isSimulating ? <SimulationExitButton /> : null}
        </div>
      </div>
    </div>
  );
}
