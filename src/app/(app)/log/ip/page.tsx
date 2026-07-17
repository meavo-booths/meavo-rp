import { redirect } from "next/navigation";

import { IpLoggerWizard } from "@/components/logger/ip-logger-wizard";
import { canLogIp } from "@/lib/domain/authz";
import { getPanelOptionsByBoothModel } from "@/lib/reference-data/sheets";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IpLogPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!canLogIp(session.user.email)) {
    redirect("/dashboard");
  }

  const panelOptions = await getPanelOptionsByBoothModel();
  return <IpLoggerWizard panelOptions={panelOptions} />;
}
