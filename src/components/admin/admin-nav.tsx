"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const linkClass = (active: boolean) =>
  `inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
    active
      ? "border-brand-600 bg-brand-600 text-white shadow-[0_2px_10px_rgba(12,143,97,0.25)]"
      : "border-slate-300 bg-white text-slate-700 hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700"
  }`;

export function AdminNav() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const own = searchParams.get("own") === "1";

  const items = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/simulate", label: "Simulate" },
    { href: "/dashboard?own=1", label: "My logged parts" },
    { href: "/admin/automations", label: "Automations" },
    { href: "/admin/data", label: "Neon data" },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const active =
          item.href === "/dashboard?own=1"
            ? pathname === "/dashboard" && own
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
