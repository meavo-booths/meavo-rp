"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setSimulateEmailAction } from "@/app/actions/rp";

const btnClass =
  "inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50";

export function SimulationExitButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={btnClass}
      onClick={() => {
        void setSimulateEmailAction("").then(() => {
          startTransition(() => router.refresh());
        });
      }}
    >
      {pending ? "Clearing…" : "Exit simulation"}
    </button>
  );
}
