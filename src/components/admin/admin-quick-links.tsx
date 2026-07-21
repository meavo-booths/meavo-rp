"use client";

import { SimulationExitButton } from "@/components/admin/simulation-exit-button";

export function AdminQuickLinks({ isSimulating }: { isSimulating: boolean }) {
  if (!isSimulating) return null;
  return <SimulationExitButton />;
}
