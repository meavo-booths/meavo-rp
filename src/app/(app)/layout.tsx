import Link from "next/link";

import { AdminSimulateBar } from "@/components/admin-simulate-bar";
import { AppActionBar } from "@/components/app-action-bar";
import { Nav } from "@/components/nav";
import { requireRpAccess } from "@/lib/meavo-auth";
import { getDashboardUiLabels } from "@/lib/ui-locale";
import { getSimulatedEmail, resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRpAccess();
  const email = session.user?.email ?? "";
  const viewer = await resolveViewerContext(email);
  const simulatedEmail = await getSimulatedEmail();
  const labels = getDashboardUiLabels(viewer.role);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-4 sm:py-8">
        {viewer.isAdmin ? (
          <AdminSimulateBar initialEmail={simulatedEmail} />
        ) : null}
        <AppActionBar
          labels={labels}
          sessionEmail={viewer.sessionEmail}
        />
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-slate-400">
        <Link href="https://meavo.app" className="hover:text-slate-600">
          meavo.app
        </Link>
      </footer>
    </>
  );
}
