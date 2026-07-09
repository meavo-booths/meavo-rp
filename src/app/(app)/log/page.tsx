import { LoggerWizard } from "@/components/logger/logger-wizard";
import { getCatalogueData } from "@/lib/reference-data/catalogue";
import {
  getAddressBookEntries,
  getPanelOptionsByBoothModel,
} from "@/lib/reference-data/sheets";
import { getEditableRpData, getSimilarRpData } from "@/lib/domain/rp-update";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ editRp?: string; similarRp?: string }>;
}) {
  const params = await searchParams;
  const [addressBook, panelOptions, catalogueCategories] = await Promise.all([
    getAddressBookEntries(),
    getPanelOptionsByBoothModel(),
    getCatalogueData(),
  ]);

  let initialForm = undefined;
  const session = await auth();
  const email = session?.user?.email ?? "";

  if (params.editRp) {
    try {
      initialForm = await getEditableRpData(params.editRp, email);
    } catch {
      initialForm = undefined;
    }
  } else if (params.similarRp) {
    try {
      initialForm = await getSimilarRpData(params.similarRp);
    } catch {
      initialForm = undefined;
    }
  }

  return (
    <LoggerWizard
      addressBook={addressBook}
      panelOptions={panelOptions}
      catalogueCategories={catalogueCategories}
      initialForm={initialForm}
      editRpNum={params.editRp}
      similarRpNum={params.similarRp}
    />
  );
}
