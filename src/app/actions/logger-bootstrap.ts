"use server";

import { requireActionSession } from "@/lib/api/require-session";
import { canLogIp } from "@/lib/domain/authz";
import {
  getEditableRpData,
  getSimilarRpData,
} from "@/lib/domain/rp-update";
import type { LoggerFormInput } from "@/lib/domain/rp-form-mapper";
import { getCatalogueData } from "@/lib/reference-data/catalogue";
import type { CatalogueCategory } from "@/lib/reference-data/catalogue";
import {
  getAddressBookEntries,
  getPanelOptionsByBoothModel,
  type AddressBookEntry,
  type PanelOptionsPayload,
} from "@/lib/reference-data/sheets";

export type LoggerBootstrapPayload = {
  addressBook: AddressBookEntry[];
  panelOptions: PanelOptionsPayload;
  catalogueCategories: CatalogueCategory[];
};

export async function getLoggerBootstrapAction(): Promise<
  LoggerBootstrapPayload & { error?: string }
> {
  await requireActionSession();
  try {
    const [addressBook, panelOptions, catalogueCategories] = await Promise.all([
      getAddressBookEntries(),
      getPanelOptionsByBoothModel(),
      getCatalogueData(),
    ]);
    return { addressBook, panelOptions, catalogueCategories };
  } catch (error) {
    return {
      addressBook: [],
      panelOptions: { modelOptions: {}, allOptions: [] },
      catalogueCategories: [],
      error:
        error instanceof Error
          ? error.message
          : "Failed to load logger reference data",
    };
  }
}

export async function getIpLoggerBootstrapAction(): Promise<{
  panelOptions: PanelOptionsPayload;
  error?: string;
}> {
  const { viewer } = await requireActionSession();
  if (!canLogIp(viewer.sessionEmail)) {
    return {
      panelOptions: { modelOptions: {}, allOptions: [] },
      error: "Access denied",
    };
  }
  try {
    const panelOptions = await getPanelOptionsByBoothModel();
    return { panelOptions };
  } catch (error) {
    return {
      panelOptions: { modelOptions: {}, allOptions: [] },
      error:
        error instanceof Error
          ? error.message
          : "Failed to load panel options",
    };
  }
}

export async function getRpLoggerPrefillAction(params: {
  editRp?: string;
  similarRp?: string;
}): Promise<{
  initialForm?: LoggerFormInput & { rpNum?: string };
  error?: string;
}> {
  const { viewer } = await requireActionSession();
  try {
    if (params.editRp) {
      const initialForm = await getEditableRpData(
        params.editRp,
        viewer.effectiveEmail,
      );
      return { initialForm };
    }
    if (params.similarRp) {
      const initialForm = await getSimilarRpData(params.similarRp);
      return { initialForm };
    }
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to load RP for edit",
    };
  }
}
