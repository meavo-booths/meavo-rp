import type { AutomationKey } from "@/lib/domain/automation-settings";
import { shouldRunInWebapp } from "@/lib/domain/automation-settings";

export async function gateCronOrRun<T>(
  key: AutomationKey,
  run: () => Promise<T>,
): Promise<T | { ok: true; skipped: true; reason: string }> {
  const enabled = await shouldRunInWebapp(key);
  if (!enabled) {
    return { ok: true, skipped: true, reason: `source=gas (${key})` };
  }
  return run();
}
