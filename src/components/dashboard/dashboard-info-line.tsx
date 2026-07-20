import type { ReactNode } from "react";

export function DashboardInfoLine({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 text-[0.9375rem] leading-snug text-slate-900">
      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-500">
        {label}:
      </span>
      {strong ? <strong>{children}</strong> : <span>{children}</span>}
    </div>
  );
}
