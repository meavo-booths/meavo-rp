import type { PanelOptionsPayload } from "@/lib/reference-data/sheets";

function normalizePanelModelKey(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/[^a-z0-9]/g, "");
}

export function getPanelsForModel(
  model: string,
  payload: PanelOptionsPayload,
): string[] {
  const key = normalizePanelModelKey(model);
  if (key && payload.modelOptions[key]?.length) {
    return payload.modelOptions[key];
  }
  return payload.allOptions;
}
