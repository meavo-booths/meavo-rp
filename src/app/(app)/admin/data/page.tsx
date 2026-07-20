import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AdminNeonSheetTable } from "@/components/admin/neon-sheet-table";
import {
  getNeonSheetPage,
  type NeonSheetTab,
} from "@/lib/domain/admin-neon-sheet";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/domain/authz";

export const dynamic = "force-dynamic";

export default async function AdminNeonDataPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAdminUser(email)) redirect("/dashboard");

  const params = await searchParams;
  const tab: NeonSheetTab = params.tab === "ip" ? "ip" : "rp";
  const data = await getNeonSheetPage({
    tab,
    search: params.q ?? "",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard" className="text-brand-600 hover:underline">
          ← Dashboard
        </Link>
        <Link
          href="/admin/automations"
          className="text-brand-600 hover:underline"
        >
          Automations
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <AdminNeonSheetTable data={data} />
      </Suspense>
    </div>
  );
}
