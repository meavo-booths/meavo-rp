"use client";

import { useState } from "react";

export function AdminSimulateBar({
  initialEmail,
}: {
  initialEmail: string | null;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply(nextEmail: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/simulate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setStatus(nextEmail ? `Simulating ${nextEmail}` : "Simulation cleared");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
      <p className="font-medium">Admin simulation</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@meavo.com"
          className="min-w-[220px] rounded border border-violet-200 bg-white px-2 py-1"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => apply(email.trim())}
          className="rounded bg-violet-700 px-3 py-1 text-white hover:bg-violet-800 disabled:opacity-50"
        >
          Simulate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => apply("")}
          className="rounded border border-violet-300 px-3 py-1 hover:bg-violet-100 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
      {status ? <p className="mt-2 text-violet-800">{status}</p> : null}
    </div>
  );
}
