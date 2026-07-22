"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setSimulateEmailAction } from "@/app/actions/rp";
import { adminPillClass } from "@/components/admin/admin-nav";
import { normalizeSimulationEmail } from "@/lib/domain/authz";
import {
  appendSimulateParam,
  SIMULATE_STORAGE_KEY,
} from "@/lib/simulate-as";

/**
 * Compact admin persona switcher for the chrome bar.
 * Accepts `anna` or `anna@meavo.com`; Apply navigates to that user's dashboard.
 * Simulation is per browser tab (URL ?as= + sessionStorage), not a shared cookie.
 */
export function AdminSimulateBar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function apply() {
    setError(null);
    const normalized = normalizeSimulationEmail(email);
    if (!normalized) {
      setError("Enter a @meavo.com user");
      return;
    }
    if (normalized !== email.trim().toLowerCase()) {
      setEmail(normalized);
    }
    const result = await setSimulateEmailAction(normalized);
    if (result.error) {
      setError(result.error);
      return;
    }
    const targetEmail = result.simulatedEmail ?? normalized;
    window.sessionStorage.setItem(SIMULATE_STORAGE_KEY, targetEmail);
    const path = appendSimulateParam(
      result.redirectTo ?? "/dashboard",
      targetEmail,
    );
    startTransition(() => {
      router.push(path);
    });
  }

  return (
    <form
      className="flex min-w-0 flex-wrap items-center justify-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void apply();
      }}
    >
      <input
        type="text"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        onBlur={() => {
          const normalized = normalizeSimulationEmail(email);
          if (normalized && normalized !== email.trim().toLowerCase()) {
            setEmail(normalized);
          }
        }}
        placeholder="name@meavo.com"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Email to simulate"
        className="min-w-[9rem] max-w-[14rem] flex-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[0.8125rem] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-100"
      />
      <button
        type="submit"
        disabled={pending}
        className={`${adminPillClass(false)} disabled:opacity-50`}
      >
        {pending ? "…" : "Simulate"}
      </button>
      {error ? (
        <span className="basis-full text-center text-[0.7rem] text-amber-800 sm:basis-auto sm:text-left">
          {error}
        </span>
      ) : null}
    </form>
  );
}
