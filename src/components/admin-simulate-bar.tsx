"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setSimulateEmailAction } from "@/app/actions/rp";
import { normalizeSimulationEmail } from "@/lib/domain/authz";

const btnClass =
  "inline-flex shrink-0 items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

/**
 * Admin-only persona switcher. Compact single row (GAS admin-launcher parity).
 * Accepts `anna` or `anna@meavo.com`.
 */
export function AdminSimulateBar({
  initialEmail,
}: {
  initialEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function apply(nextEmail: string) {
    setStatus(null);
    setError(null);
    const normalized = normalizeSimulationEmail(nextEmail);
    if (normalized && normalized !== nextEmail.trim().toLowerCase()) {
      setEmail(normalized);
    }
    const result = await setSimulateEmailAction(nextEmail);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (normalized) {
      setEmail(normalized);
      setStatus(`Simulating ${normalized}`);
    } else {
      setEmail("");
      setStatus("Cleared");
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
      <form
        className="flex flex-wrap items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void apply(email);
        }}
      >
        <span className="hidden text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 sm:inline">
          Simulate
        </span>
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
          placeholder="name or name@meavo.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Email to simulate"
          className="min-w-[10rem] flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-100 sm:max-w-xs sm:flex-none"
        />
        <button type="submit" disabled={pending} className={btnClass}>
          Apply
        </button>
        <button
          type="button"
          disabled={pending}
          className={btnClass}
          onClick={() => void apply("")}
        >
          Clear
        </button>
        {error ? (
          <span className="w-full text-xs text-amber-800 sm:w-auto">{error}</span>
        ) : null}
        {status && !error ? (
          <span className="w-full text-xs text-brand-700 sm:w-auto">{status}</span>
        ) : null}
      </form>
    </div>
  );
}
