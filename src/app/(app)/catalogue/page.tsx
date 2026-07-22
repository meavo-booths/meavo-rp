import { redirect } from "next/navigation";

/** Legacy path — MRP catalogue lives under Settings at /admin/catalogue. */
export default function CatalogueRedirectPage() {
  redirect("/admin/catalogue");
}
