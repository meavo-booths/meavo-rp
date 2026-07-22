"use server";

import { revalidatePath } from "next/cache";

import { requireActionSession } from "@/lib/api/require-session";
import {
  canAccessCatalogue,
  canDeductMaterials,
} from "@/lib/domain/authz";
import {
  bulkLinkPartsByEqualCode,
  callMrpDeduct,
  deletePanelMap,
  deletePartMap,
  seedExactMatchPanelMaps,
  upsertPanelMap,
  upsertPartMap,
  type DeductApiResult,
} from "@/lib/domain/catalogue-mrp";

export type CatalogueActionResult = {
  error?: string;
  linked?: number;
  skipped?: number;
  deduct?: DeductApiResult;
};

function revalidateCatalogue() {
  revalidatePath("/admin/catalogue");
  revalidatePath("/catalogue");
}

export async function upsertPartMapAction(input: {
  partRpCode: string;
  mrpMaterialId: string;
  notes?: string;
}): Promise<CatalogueActionResult> {
  const { viewer } = await requireActionSession();
  if (!canAccessCatalogue(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await upsertPartMap(input);
    revalidateCatalogue();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deletePartMapAction(
  id: string,
): Promise<CatalogueActionResult> {
  const { viewer } = await requireActionSession();
  if (!canAccessCatalogue(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await deletePartMap(id);
    revalidateCatalogue();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function upsertPanelMapAction(input: {
  boothModelName: string;
  rpPanelName: string;
  boothElementId: string;
  notes?: string;
}): Promise<CatalogueActionResult> {
  const { viewer } = await requireActionSession();
  if (!canAccessCatalogue(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await upsertPanelMap(input);
    revalidateCatalogue();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deletePanelMapAction(
  id: string,
): Promise<CatalogueActionResult> {
  const { viewer } = await requireActionSession();
  if (!canAccessCatalogue(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await deletePanelMap(id);
    revalidateCatalogue();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function bulkLinkPartsByEqualCodeAction(): Promise<CatalogueActionResult> {
  const { viewer } = await requireActionSession();
  if (!canAccessCatalogue(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    const { linked } = await bulkLinkPartsByEqualCode();
    revalidateCatalogue();
    return { linked };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function seedExactMatchPanelMapsAction(): Promise<CatalogueActionResult> {
  const { viewer } = await requireActionSession();
  if (!canAccessCatalogue(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    const result = await seedExactMatchPanelMaps();
    revalidateCatalogue();
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deductMaterialsAction(input: {
  rpLineItemIds: string[];
}): Promise<CatalogueActionResult> {
  const { viewer } = await requireActionSession();
  if (!canDeductMaterials(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  if (!input.rpLineItemIds.length) {
    return { error: "No line items selected" };
  }
  try {
    const deduct = await callMrpDeduct({
      rpLineItemIds: input.rpLineItemIds,
    });
    revalidateCatalogue();
    return { deduct };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}
