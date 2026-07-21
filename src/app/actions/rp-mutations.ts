"use server";

import { revalidatePath } from "next/cache";

import { requireActionSession } from "@/lib/api/require-session";
import {
  canAnnaMarkReady,
  canEditDueDate,
  canEditPayer,
  canLogIp,
  canShipRpParts,
  isActiveUrgentPanelsUser,
  isLogisticsViewer,
  normalizeEmail,
} from "@/lib/domain/authz";
import {
  nikolayMarkIpReadyForWarehouse,
  stefanMarkIpReadyForWarehouse,
  todorMarkIpDeliveredAtTopoli,
} from "@/lib/domain/ip-mutations";
import type { IpLoggerFormInput } from "@/lib/domain/ip-create";
import { processNewIpEntry } from "@/lib/domain/ip-create";
import {
  claimSubmitKey,
  completeSubmitKey,
  releaseSubmitKey,
} from "@/lib/domain/logger-submit-idempotency";
import {
  annaMarkReadyForLogistics,
  annaRevertReadyToActive,
  briefActiveUrgentPanel,
  markActiveUrgentPanelReady,
  revertToActive,
  saveShipInfoOnly,
  updateActiveUrgentPanelsEta,
  updateDueDate,
  updatePartToShipped,
  updatePayer,
  updateWorkshopNote,
} from "@/lib/domain/rp-mutations";
import { markPanelsFromStock } from "@/lib/domain/stock-replacement";
import type {
  MarkPanelsFromStockInput,
  StockPanelDetails,
} from "@/lib/domain/stock-replacement";
import { isPanelLineItem } from "@/lib/domain/rp-line-items";
import { prisma } from "@/lib/prisma";

export type ActionResult = { error?: string };

function revalidateDashboards() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/nikolay");
  revalidatePath("/dashboard/stefan");
  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/urgent-panels");
  revalidatePath("/dashboard/ivan");
  revalidatePath("/dashboard/todor");
}

export async function shipRpAction(
  rpNum: string,
  method: string,
  tracking: string,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!canShipRpParts(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await updatePartToShipped(rpNum, method, tracking, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function revertRpAction(rpNum: string): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  try {
    await revertToActive(rpNum, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function saveShipInfoAction(
  rpNum: string,
  method: string,
  tracking: string,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!canShipRpParts(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await saveShipInfoOnly(rpNum, method, tracking, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function annaReadyAction(rpNum: string): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!canAnnaMarkReady(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await annaMarkReadyForLogistics(rpNum, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function annaRevertReadyAction(rpNum: string): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!canAnnaMarkReady(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await annaRevertReadyToActive(rpNum, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function briefUrgentPanelAction(
  rpNum: string,
  productionEta: string,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!isActiveUrgentPanelsUser(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await briefActiveUrgentPanel(rpNum, productionEta, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateUrgentEtaAction(
  rpNum: string,
  newDate: string,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!isActiveUrgentPanelsUser(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await updateActiveUrgentPanelsEta(rpNum, newDate, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function markUrgentReadyAction(rpNum: string): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!isActiveUrgentPanelsUser(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await markActiveUrgentPanelReady(rpNum, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function useExistingPanelAction(
  input: MarkPanelsFromStockInput,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!isActiveUrgentPanelsUser(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await markPanelsFromStock({ ...input, actorEmail: viewer.effectiveEmail });
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function useExistingPanelForRpAction(
  rpNum: string,
  stockDetails: StockPanelDetails,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!isActiveUrgentPanelsUser(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    const row = await prisma.rpRequest.findUnique({ where: { rpNum } });
    if (!row) return { error: "RP not found" };
    const lineItems = await prisma.rpLineItem.findMany({
      where: { rpRequestId: row.id, fulfillment: "pending" },
    });
    const lineItemIds = lineItems.filter(isPanelLineItem).map((item) => item.id);
    if (!lineItemIds.length) {
      return { error: "No pending panel line items on this RP" };
    }
    await markPanelsFromStock({
      rpId: row.id,
      lineItemIds,
      stockDetails,
      actorEmail: viewer.effectiveEmail,
    });
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateWorkshopNoteAction(
  recordType: "rp" | "ip",
  recordNum: string,
  note: string,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  try {
    await updateWorkshopNote(recordType, recordNum, note, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updatePayerAction(
  rpNum: string,
  payer: string,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!canEditPayer(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await updatePayer(rpNum, payer, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateDueDateAction(
  recordType: "rp" | "ip",
  recordNum: string,
  newDate: string,
  reason: string,
): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (!canEditDueDate(viewer.effectiveEmail)) {
    return { error: "Access denied" };
  }
  try {
    await updateDueDate(recordType, recordNum, newDate, reason, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function nikolayIpReadyAction(ipNum: string): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (normalizeEmail(viewer.effectiveEmail) !== "nikolay@meavo.com") {
    return { error: "Access denied" };
  }
  try {
    await nikolayMarkIpReadyForWarehouse(ipNum, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function stefanIpReadyAction(ipNum: string): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (normalizeEmail(viewer.effectiveEmail) !== "stefan@meavo.com") {
    return { error: "Access denied" };
  }
  try {
    await stefanMarkIpReadyForWarehouse(ipNum, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function todorIpDeliveredAction(ipNum: string): Promise<ActionResult> {
  const { viewer } = await requireActionSession();
  if (normalizeEmail(viewer.effectiveEmail) !== "todor.dimitrov@meavo.com") {
    return { error: "Access denied" };
  }
  try {
    await todorMarkIpDeliveredAtTopoli(ipNum, viewer.effectiveEmail);
    revalidateDashboards();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function createIpEntryAction(
  form: IpLoggerFormInput,
  submitKey?: string,
): Promise<ActionResult & { ipNums?: string[] }> {
  const { viewer } = await requireActionSession();
  if (!canLogIp(viewer.sessionEmail)) {
    return { error: "Access denied" };
  }
  let claimed = false;
  try {
    if (submitKey) {
      const claim = await claimSubmitKey("ip", submitKey);
      if (claim.kind === "hit") {
        return { ipNums: claim.nums };
      }
      if (claim.kind === "busy") {
        return { error: "Submit already in progress — please wait" };
      }
      claimed = true;
    }
    const result = await processNewIpEntry(form, viewer.effectiveEmail);
    if (submitKey) {
      await completeSubmitKey("ip", submitKey, result.ipNums);
    }
    revalidatePath("/dashboard/nikolay");
    return { ipNums: result.ipNums };
  } catch (e) {
    if (claimed && submitKey) {
      await releaseSubmitKey("ip", submitKey);
    }
    return { error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function canMutateLogistics(): Promise<boolean> {
  const { viewer } = await requireActionSession();
  return isLogisticsViewer(viewer.effectiveEmail);
}
