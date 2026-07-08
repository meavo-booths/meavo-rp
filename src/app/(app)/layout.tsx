import Link from "next/link";

import { AdminSimulateBar } from "@/components/admin-simulate-bar";
import { AppHeader } from "@/components/app-header";
import { requireRpAccess } from "@/lib/meavo-auth";
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

  return (
    <>
      <AppHeader viewer={viewer} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        {viewer.isAdmin ? (
          <AdminSimulateBar initialEmail={simulatedEmail} />
        ) : null}
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
