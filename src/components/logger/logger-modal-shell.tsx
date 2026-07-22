"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** GAS-style logger card in an overlay popup. */
export function LoggerModalShell({
  title,
  subtitle,
  onClose,
  busy,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="relative flex max-h-[96vh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-xl border border-[#F2F0EB] bg-white shadow-[0_20px_56px_rgba(33,33,33,0.12)] sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1 w-full shrink-0 bg-brand-700" aria-hidden />
        <div className="flex items-start justify-between gap-3 border-b border-[#F2F0EB] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-sm font-medium text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
