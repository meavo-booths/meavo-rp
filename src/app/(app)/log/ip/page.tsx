import { redirect } from "next/navigation";

import { canLogIp } from "@/lib/domain/authz";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Deep-link landing — LoggerModalProvider opens the IP popup and routes to /dashboard. */
export default async function IpLogPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!canLogIp(session.user.email)) {
    redirect("/dashboard");
  }

  return (
    <p className="py-16 text-center text-sm text-slate-500">Opening IP logger…</p>
  );
}
