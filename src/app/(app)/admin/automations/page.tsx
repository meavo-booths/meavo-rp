import { redirect } from "next/navigation";

import { AutomationSettingsForm } from "@/components/admin/automation-settings-form";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  AUTOMATION_SETTING_ROWS,
  getAutomationSettings,
  isNotificationsForceOff,
} from "@/lib/domain/automation-settings";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/domain/authz";

export const dynamic = "force-dynamic";

export default async function AdminAutomationsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAdminUser(email)) redirect("/dashboard");

  const settings = await getAutomationSettings();

  return (
    <div className="space-y-4">
      <AdminNav />
      <AutomationSettingsForm
        rows={AUTOMATION_SETTING_ROWS}
        settings={settings}
        forceOff={isNotificationsForceOff()}
      />
    </div>
  );
}
