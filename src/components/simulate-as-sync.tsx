"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  SIMULATE_QUERY_PARAM,
  SIMULATE_STORAGE_KEY,
} from "@/lib/simulate-as";

/**
 * Keeps `?as=` in sync with this tab's sessionStorage so in-app navigations
 * (which may drop the query) still stay on the same simulated persona — without
 * affecting other tabs (cookies are shared; sessionStorage is not).
 */
export function SimulateAsSync() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const urlAs =
      searchParams.get(SIMULATE_QUERY_PARAM)?.trim().toLowerCase() ?? "";
    const stored =
      window.sessionStorage.getItem(SIMULATE_STORAGE_KEY)?.trim().toLowerCase() ??
      "";

    if (urlAs && urlAs.endsWith("@meavo.com") && urlAs !== stored) {
      window.sessionStorage.setItem(SIMULATE_STORAGE_KEY, urlAs);
      return;
    }

    if (stored && stored.endsWith("@meavo.com") && urlAs !== stored) {
      const next = new URLSearchParams(searchParams.toString());
      next.set(SIMULATE_QUERY_PARAM, stored);
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    }
  }, [pathname, searchParams, router]);

  return null;
}
