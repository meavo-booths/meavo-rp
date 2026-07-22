"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { appendSimulateParam, SIMULATE_QUERY_PARAM } from "@/lib/simulate-as";

export const adminPillClass = (active: boolean) =>
  `inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
    active
      ? "border-brand-600 bg-brand-600 text-white shadow-[0_2px_10px_rgba(12,143,97,0.25)]"
      : "border-slate-300 bg-white text-slate-700 hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700"
  }`;

/** Primary admin destinations shown next to the page title. */
export function AdminNav() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const as = searchParams.get(SIMULATE_QUERY_PARAM);
  const dashboardHref = appendSimulateParam("/admin/dashboard", as);
  const catalogueHref = appendSimulateParam("/catalogue", as);
  const dashboardActive =
    pathname === "/admin/dashboard" || pathname.startsWith("/admin/dashboard/");
  const catalogueActive = pathname.startsWith("/catalogue");

  return (
    <nav className="flex flex-wrap items-center gap-2">
      <Link href={dashboardHref} className={adminPillClass(dashboardActive)}>
        Dashboard
      </Link>
      <Link href={catalogueHref} className={adminPillClass(catalogueActive)}>
        Catalogue
      </Link>
    </nav>
  );
}
