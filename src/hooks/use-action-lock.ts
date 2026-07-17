"use client";

import { useCallback, useRef, useState } from "react";

/** Prevents overlapping async actions (double-click, Enter spam, onBlur retries). */
export function useActionLock() {
  const lockRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const runLocked = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (lockRef.current) return undefined;
      lockRef.current = true;
      setBusy(true);
      try {
        return await fn();
      } finally {
        lockRef.current = false;
        setBusy(false);
      }
    },
    [],
  );

  return { busy, runLocked };
}
