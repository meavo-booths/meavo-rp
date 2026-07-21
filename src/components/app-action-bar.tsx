import Link from "next/link";

import { canLogIp } from "@/lib/domain/authz";
import type { DashboardUiLabels } from "@/lib/ui-locale";

const pillPrimary =
  "inline-flex items-center justify-center rounded-full bg-brand-600 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100";
const pillSecondary =
  "inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-[0.8125rem] font-semibold text-slate-800 hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100";

/** Primary CTAs — GAS headerControls pill style. */
export function AppActionBar({
  labels,
  sessionEmail,
  showLogIp,
  showAdminLink,
}: {
  labels: Pick<DashboardUiLabels, "logRp" | "logIp">;
  sessionEmail: string;
  showLogIp?: boolean;
  showAdminLink?: boolean;
}) {
  const ip = showLogIp ?? canLogIp(sessionEmail);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/log" className={pillPrimary}>
        {labels.logRp}
      </Link>
      {ip ? (
        <Link href="/log/ip" className={pillSecondary}>
          {labels.logIp}
        </Link>
      ) : null}
      {showAdminLink ? (
        <Link href="/admin/dashboard" className={pillSecondary}>
          Admin
        </Link>
      ) : null}
    </div>
  );
}

export { pillPrimary, pillSecondary };
