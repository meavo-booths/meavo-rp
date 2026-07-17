"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setSimulateEmailAction } from "@/app/actions/rp";
import { normalizeSimulationEmail } from "@/lib/domain/authz";

const actionBtnClass =
  "inline-flex shrink-0 items-center rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50";

/**
 * Admin-only persona switcher. Accepts `anna` or `anna@meavo.com` (GAS parity).
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
      setStatus("Simulation cleared");
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
      <p className="font-medium">Admin simulation</p>
      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void apply(email);
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
          placeholder="name or name@meavo.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Email to simulate"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:max-w-xs"
        />
        <button type="submit" disabled={pending} className={actionBtnClass}>
          Simulate
        </button>
        <button
          type="button"
          disabled={pending}
          className={actionBtnClass}
          onClick={() => void apply("")}
        >
          Clear
        </button>
        <a href="/dashboard?own=1" className={actionBtnClass}>
          My logged parts
        </a>
        <a href="/admin/automations" className={actionBtnClass}>
          Automations
        </a>
      </form>
      {error ? (
        <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-950">
          {error}
        </p>
      ) : null}
      {status && !error ? (
        <p className="mt-2 text-violet-800">{status}</p>
      ) : null}
    </div>
  );
}
