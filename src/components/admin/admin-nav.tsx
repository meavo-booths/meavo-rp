"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const adminPillClass = (active: boolean) =>
  `inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
    active
      ? "border-brand-600 bg-brand-600 text-white shadow-[0_2px_10px_rgba(12,143,97,0.25)]"
      : "border-slate-300 bg-white text-slate-700 hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700"
  }`;

/** Primary admin destinations shown next to the page title. */
export function AdminNav() {
  const pathname = usePathname() ?? "";
  const href = "/admin/dashboard";
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-wrap items-center gap-2">
      <Link href={href} className={adminPillClass(active)}>
        Dashboard
      </Link>
    </nav>
  );
}
