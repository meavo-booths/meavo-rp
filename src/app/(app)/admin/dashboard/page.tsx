import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getAdminDashboardData } from "@/lib/domain/admin-dashboard";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/domain/authz";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAdminUser(email)) redirect("/dashboard");

  const data = await getAdminDashboardData();

  return (
    <AdminDashboard data={data} />
  );
}
