"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setSimulateEmailAction } from "@/app/actions/rp";
import { Button } from "@/components/ui";

export function AdminSimulateBar({
  initialEmail,
}: {
  initialEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function apply(nextEmail: string) {
    setStatus(null);
    const result = await setSimulateEmailAction(nextEmail);
    if (result.error) {
      setStatus(result.error);
      return;
    }
    setStatus(nextEmail ? `Simulating ${nextEmail}` : "Simulation cleared");
    startTransition(() => router.refresh());
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
          aria-label="Email to simulate"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:max-w-xs"
        />
        <Button
          disabled={pending}
          className="shrink-0"
          onClick={() => void apply(email.trim())}
        >
          Simulate
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          className="shrink-0"
          onClick={() => void apply("")}
        >
          Clear
        </Button>
        <a
          href="/dashboard?own=1"
          className="inline-flex shrink-0 items-center rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100"
        >
          My logged parts
        </a>
        <a
          href="/admin/automations"
          className="inline-flex shrink-0 items-center rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100"
        >
          Automations
        </a>
      </div>
      {status ? <p className="mt-2 text-violet-800">{status}</p> : null}
    </div>
  );
}
