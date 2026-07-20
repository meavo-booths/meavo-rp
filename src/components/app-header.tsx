"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

import type { ViewerContext } from "@/lib/viewer-context";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/log", label: "Log RP" },
];

export function AppHeader({
  viewer,
}: {
  viewer: Pick<ViewerContext, "sessionEmail" | "effectiveEmail" | "isSimulating">;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
          Meavo RP
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-slate-600 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
          <span className="text-slate-500">
            {viewer.isSimulating ? (
              <>
                simulating <strong>{viewer.effectiveEmail}</strong>
              </>
            ) : (
              viewer.sessionEmail
            )}
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-slate-600 hover:text-slate-900"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
