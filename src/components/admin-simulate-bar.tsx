"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setSimulateEmailAction } from "@/app/actions/rp";
import { Button, Input } from "@/components/ui";

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
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@meavo.com"
          className="min-w-[220px]"
        />
        <Button
          disabled={pending}
          className="px-3 py-1"
          onClick={() => apply(email.trim())}
        >
          Simulate
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          className="px-3 py-1"
          onClick={() => apply("")}
        >
          Clear
        </Button>
        <a
          href="/admin/automations"
          className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-sm text-violet-900 hover:bg-violet-100"
        >
          Automations
        </a>
      </div>
      {status ? <p className="mt-2 text-violet-800">{status}</p> : null}
    </div>
  );
}
