import { redirect } from "next/navigation";

import { IpLoggerWizard } from "@/components/logger/ip-logger-wizard";
import { getPanelOptionsByBoothModel } from "@/lib/reference-data/sheets";
import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

export default async function IpLogPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await resolveViewerContext(session.user.email);
  if (
    viewer.role !== "nikolay" &&
    viewer.role !== "admin" &&
    !viewer.isAdmin
  ) {
    redirect("/dashboard");
  }

  const panelOptions = await getPanelOptionsByBoothModel();
  return <IpLoggerWizard panelOptions={panelOptions} />;
}
