"use client";

import { usePathname, useSearchParams } from "next/navigation";

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
  if (pathname.startsWith("/admin/automations")) {
    return "Automations";
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
 * “Viewing as …” only when an admin is simulating another user.
 */
export function AppChromeTitle({ viewer }: { viewer: ViewerContext }) {
  const pathname = usePathname() ?? "/dashboard";
  const searchParams = useSearchParams();
  const title = titleForPath(pathname, searchParams, viewer);
  const labels = getDashboardUiLabels(viewer.role, {
    ownLoggedParts: true,
  });

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 sm:px-4">
        <h1 className="text-sm font-semibold text-slate-900 sm:text-base">
          {title}
        </h1>
        {viewer.isSimulating ? (
          <p className="text-xs text-slate-500 sm:text-sm">
            {labels.viewingAs}{" "}
            <strong className="font-medium text-slate-700">
              {viewer.effectiveEmail}
            </strong>
          </p>
        ) : null}
      </div>
    </div>
  );
}
