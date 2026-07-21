"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const linkClass = (active: boolean) =>
  `inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${
    active
      ? "border-brand-600 bg-brand-50 text-brand-800"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;

export function AdminNav() {
  const pathname = usePathname() ?? "";

  const items = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/simulate", label: "Simulate" },
    { href: "/dashboard?own=1", label: "My logged parts" },
    { href: "/admin/automations", label: "Automations" },
    { href: "/admin/data", label: "Neon data" },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
      <span className="mr-1 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
        Admin
      </span>
      {items.map((item) => {
        const active =
          item.href === "/dashboard?own=1"
            ? false
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={linkClass(active)}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
