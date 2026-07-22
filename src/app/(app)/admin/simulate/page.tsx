import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Simulate lives in the admin chrome bar — keep this URL as a redirect. */
export default function AdminSimulatePage() {
  redirect("/admin/dashboard");
}
