"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { adminPillClass } from "@/components/admin/admin-nav";
import { useLoggerModal } from "@/components/logger/logger-modal-context";
import {
  appendSimulateParam,
  SIMULATE_QUERY_PARAM,
} from "@/lib/simulate-as";

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

function DropdownButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3.5 py-2 text-left text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800"
    >
      {children}
    </button>
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
  const { openRpLogger, openIpLogger } = useLoggerModal();

  const myPartsActive = pathname === "/dashboard" && own;
  const settingsActive =
    pathname.startsWith("/admin/automations") ||
    pathname.startsWith("/admin/data") ||
    pathname.startsWith("/admin/catalogue") ||
    pathname.startsWith("/catalogue");
  const as = searchParams.get(SIMULATE_QUERY_PARAM);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <DropdownPill label="Log">
        <DropdownButton
          onClick={() => {
            openRpLogger();
          }}
        >
          Log an RP
        </DropdownButton>
        <DropdownButton
          onClick={() => {
            openIpLogger();
          }}
        >
          Log an IP
        </DropdownButton>
      </DropdownPill>

      <Link
        href={appendSimulateParam("/dashboard?own=1", as)}
        className={adminPillClass(myPartsActive)}
      >
        My logged parts
      </Link>

      <DropdownPill label="Settings" active={settingsActive}>
        <DropdownItem
          href={appendSimulateParam("/admin/automations", as)}
        >
          Automations
        </DropdownItem>
        <DropdownItem href={appendSimulateParam("/admin/data", as)}>
          Neon data
        </DropdownItem>
        <DropdownItem href={appendSimulateParam("/admin/catalogue", as)}>
          Catalogue / MRP maps
        </DropdownItem>
      </DropdownPill>
    </div>
  );
}
