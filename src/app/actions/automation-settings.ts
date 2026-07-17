"use server";

import { revalidatePath } from "next/cache";

import { requireActionSession } from "@/lib/api/require-session";
import { assertAdmin } from "@/lib/domain/authz";
import {
  type AutomationKey,
  type AutomationSettingsMap,
  type AutomationSource,
  forceAllAutomationsToGas,
  saveAutomationSettings,
} from "@/lib/domain/automation-settings";

export type ActionResult = { error?: string };

export async function updateAutomationSettingsAction(
  key: AutomationKey,
  source: AutomationSource,
): Promise<ActionResult> {
  const { session } = await requireActionSession();
  try {
    assertAdmin(session.user?.email);
    await saveAutomationSettings({ [key]: source } as Partial<AutomationSettingsMap>);
    revalidatePath("/admin/automations");
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save settings",
    };
  }
}

export async function forceAllAutomationsToGasAction(): Promise<ActionResult> {
  const { session } = await requireActionSession();
  try {
    assertAdmin(session.user?.email);
    await forceAllAutomationsToGas();
    revalidatePath("/admin/automations");
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to reset settings",
    };
  }
}
