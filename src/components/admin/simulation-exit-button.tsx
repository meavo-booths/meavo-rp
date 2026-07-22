"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setSimulateEmailAction } from "@/app/actions/rp";
import { SIMULATE_STORAGE_KEY } from "@/lib/simulate-as";

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
        window.sessionStorage.removeItem(SIMULATE_STORAGE_KEY);
        void setSimulateEmailAction("").then((result) => {
          startTransition(() => {
            router.push(result.redirectTo ?? "/admin/dashboard");
          });
        });
      }}
    >
      {pending ? "Clearing…" : "Exit simulation"}
    </button>
  );
}
