import { redirect } from "next/navigation";

import { CatalogueClient, type CatalogueTab } from "@/components/catalogue/catalogue-client";
import {
  canAccessCatalogue,
  canDeductMaterials,
  isAdminUser,
} from "@/lib/domain/authz";
import {
  listCataloguePanels,
  listCatalogueParts,
  listMrpElementOptions,
  listMrpMaterialOptions,
  listPanelMaps,
  listPartMaps,
  listReadyUndeductedLines,
} from "@/lib/domain/catalogue-mrp";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseTab(raw: string | undefined): CatalogueTab {
  if (raw === "panels" || raw === "mappings" || raw === "ready") return raw;
  return "parts";
}

export default async function AdminCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAdminUser(email) || !canAccessCatalogue(email)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const tab = parseTab(params.tab);

  const [parts, panels, partMaps, panelMaps, materials, elements, readyLines] =
    await Promise.all([
      listCatalogueParts(),
      listCataloguePanels(),
      listPartMaps(),
      listPanelMaps(),
      listMrpMaterialOptions(),
      listMrpElementOptions(),
      listReadyUndeductedLines(),
    ]);

  return (
    <CatalogueClient
      tab={tab}
      parts={parts}
      panels={panels}
      partMaps={partMaps}
      panelMaps={panelMaps}
      materials={materials}
      elements={elements}
      readyLines={readyLines}
      canDeduct={canDeductMaterials(email)}
    />
  );
}
