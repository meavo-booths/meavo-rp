import Link from "next/link";

import { canLogIp } from "@/lib/domain/authz";
import type { DashboardUiLabels } from "@/lib/ui-locale";

/** Primary CTAs under the shared Meavo nav — not nav links. */
export function AppActionBar({
  labels,
  sessionEmail,
  showLogIp,
}: {
  labels: Pick<DashboardUiLabels, "logRp" | "logIp">;
  sessionEmail: string;
  showLogIp?: boolean;
}) {
  const ip =
    showLogIp ?? canLogIp(sessionEmail);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/log"
        className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        {labels.logRp}
      </Link>
      {ip ? (
        <Link
          href="/log/ip"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          {labels.logIp}
        </Link>
      ) : null}
    </div>
  );
}
