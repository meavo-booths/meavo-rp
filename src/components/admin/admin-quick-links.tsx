"use client";

import Link from "next/link";

import { SimulationExitButton } from "@/components/admin/simulation-exit-button";
import { pillSecondary } from "@/components/app-action-bar";

export function AdminQuickLinks({ isSimulating }: { isSimulating: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isSimulating ? <SimulationExitButton /> : null}
      <Link href="/admin/dashboard" className={pillSecondary}>
        Admin
      </Link>
      {isSimulating ? (
        <Link href="/admin/simulate" className={pillSecondary}>
          Simulate
        </Link>
      ) : null}
    </div>
  );
}
