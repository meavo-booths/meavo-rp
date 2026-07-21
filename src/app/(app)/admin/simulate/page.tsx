import { AdminSimulateBar } from "@/components/admin-simulate-bar";
import { Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/domain/authz";
import { getSimulatedEmail } from "@/lib/viewer-context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminSimulatePage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAdminUser(email)) redirect("/dashboard");

  const simulatedEmail = await getSimulatedEmail();

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Simulate user</h2>
      <p className="text-sm text-slate-600">
        View the app as another @meavo.com user. Simulation applies across all routes until
        cleared.
      </p>
      <AdminSimulateBar initialEmail={simulatedEmail} />
    </Card>
  );
}
