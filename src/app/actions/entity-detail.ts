"use server";

import { requireActionSession } from "@/lib/api/require-session";
import {
  getEntityDetail,
  type EntityDetail,
} from "@/lib/domain/entity-detail";
import type { LifecycleEntityType } from "@/lib/domain/lifecycle-events";

export type EntityDetailActionResult =
  | { detail: EntityDetail; error?: undefined }
  | { detail?: undefined; error: string };

export async function getEntityDetailAction(
  recordType: LifecycleEntityType,
  recordNum: string,
): Promise<EntityDetailActionResult> {
  await requireActionSession();
  try {
    if (recordType !== "rp" && recordType !== "ip") {
      return { error: "Invalid record type" };
    }
    const num = (recordNum ?? "").trim();
    if (!num) return { error: "Missing record number" };
    const detail = await getEntityDetail(recordType, num);
    return { detail };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load detail" };
  }
}
