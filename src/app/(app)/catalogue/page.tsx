import { redirect } from "next/navigation";

import { CatalogueClient, type CatalogueTab } from "@/components/catalogue/catalogue-client";
import { canAccessCatalogue, canDeductMaterials } from "@/lib/domain/authz";
import {
  listCataloguePanels,
  listCatalogueParts,
  listMrpElementOptions,
  listMrpMaterialOptions,
  listPanelMaps,
  listPartMaps,
  listReadyUndeductedLines,
} from "@/lib/domain/catalogue-mrp";
import { requireRpAccess } from "@/lib/meavo-auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export const dynamic = "force-dynamic";

function parseTab(raw: string | undefined): CatalogueTab {
  if (raw === "panels" || raw === "mappings" || raw === "ready") return raw;
  return "parts";
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireRpAccess();
  const email = session.user?.email ?? "";
  const viewer = await resolveViewerContext(email);
  if (!canAccessCatalogue(viewer.effectiveEmail)) {
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
      canDeduct={canDeductMaterials(viewer.effectiveEmail)}
    />
  );
}
