"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Auto-refresh dashboard data every 60s (GAS parity). */
export function useDashboardRefresh(enabled = true) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [enabled, router]);
}
