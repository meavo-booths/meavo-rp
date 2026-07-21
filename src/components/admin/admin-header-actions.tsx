"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { adminPillClass } from "@/components/admin/admin-nav";

function DropdownPill({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="relative">
      <summary
        className={`${adminPillClass(Boolean(active))} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        {label}
        <span className="ml-1.5 text-[0.7rem] opacity-70" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}

function DropdownItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800"
    >
      {children}
    </Link>
  );
}

/** Right-side admin header actions: Log, My logged parts, Settings. */
export function AdminHeaderActions() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const own = searchParams.get("own") === "1";

  const myPartsActive = pathname === "/dashboard" && own;
  const settingsActive =
    pathname.startsWith("/admin/automations") ||
    pathname.startsWith("/admin/data");
  const logActive = pathname.startsWith("/log");

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <DropdownPill label="Log" active={logActive}>
        <DropdownItem href="/log">Log an RP</DropdownItem>
        <DropdownItem href="/log/ip">Log an IP</DropdownItem>
      </DropdownPill>

      <Link
        href="/dashboard?own=1"
        className={adminPillClass(myPartsActive)}
      >
        My logged parts
      </Link>

      <DropdownPill label="Settings" active={settingsActive}>
        <DropdownItem href="/admin/automations">Automations</DropdownItem>
        <DropdownItem href="/admin/data">Neon data</DropdownItem>
      </DropdownPill>
    </div>
  );
}
