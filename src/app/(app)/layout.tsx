import { Suspense } from "react";
import Link from "next/link";

import { AppChromeTitle } from "@/components/app-chrome-title";
import { AppLayoutChrome } from "@/components/app-layout-chrome";
import { Nav } from "@/components/nav";
import { requireRpAccess } from "@/lib/meavo-auth";
import { getDashboardUiLabels } from "@/lib/ui-locale";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRpAccess();
  const email = session.user?.email ?? "";
  const viewer = await resolveViewerContext(email);
  const labels = getDashboardUiLabels(viewer.role);

  return (
    <>
      <Nav />
      <Suspense
        fallback={
          <div className="border-b border-slate-200 bg-white py-1.5" />
        }
      >
        <AppChromeTitle viewer={viewer} />
      </Suspense>
      <main className="mx-auto max-w-[1720px] space-y-3 px-3 py-3 sm:px-4 sm:py-5">
        <AppLayoutChrome
          labels={labels}
          sessionEmail={viewer.sessionEmail}
          isAdmin={viewer.isAdmin}
        />
        {children}
      </main>
      <footer className="mx-auto max-w-[1720px] px-4 pb-8 text-center text-xs text-slate-400">
        <Link href="https://meavo.app" className="hover:text-slate-600">
          meavo.app
        </Link>
      </footer>
    </>
  );
}
