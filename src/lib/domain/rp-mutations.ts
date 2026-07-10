import { enqueueSheetSync } from "@/lib/domain/panel-orders";
import { normalizeRpNum } from "@/lib/domain/rp-numbers";
import { notifyAfterRpMutation } from "@/lib/integrations/slack/rp-slack-bot";
import { prisma } from "@/lib/prisma";

function isPalletOrContainer(method: string | null | undefined): boolean {
  const m = (method ?? "").trim().toLowerCase();
  return m === "pallet" || m === "container";
}

function isUsaMarket(market: string | null | undefined): boolean {
  const m = (market ?? "").trim().toLowerCase();
  return ["usa", "united states", "us", "united states of america"].includes(m);
}

async function findRp(rpNum: string) {
  const normalized = normalizeRpNum(rpNum);
  const row = await prisma.rpRequest.findUnique({ where: { rpNum: normalized } });
  if (!row) throw new Error("RP not found");
  return row;
}

export async function updatePartToShipped(
  rpNum: string,
  method: string,
  tracking: string,
): Promise<void> {
  const row = await findRp(rpNum);
  await prisma.rpRequest.update({
    where: { id: row.id },
    data: {
      shipMethod: method.trim(),
      status: "Shipped",
      tracking: tracking.trim(),
      updatedAt: new Date(),
    },
  });
  await enqueueSheetSync("rp", row.id);
  void notifyAfterRpMutation(rpNum, "status_changed");
}

export async function revertToActive(rpNum: string, actorEmail: string): Promise<void> {
  const row = await findRp(rpNum);
  const owner = (row.userId ?? "").trim().toLowerCase();
  if (owner !== actorEmail.trim().toLowerCase()) {
    throw new Error("Only the RP owner can revert");
  }
  const nextStatus = isPalletOrContainer(row.shipMethod) ? "Ready" : "Briefed";
  await prisma.rpRequest.update({
    where: { id: row.id },
    data: { status: nextStatus, updatedAt: new Date() },
  });
  await enqueueSheetSync("rp", row.id);
}

export async function saveShipInfoOnly(
  rpNum: string,
  method: string,
  tracking: string,
): Promise<void> {
  const row = await findRp(rpNum);
  await prisma.rpRequest.update({
    where: { id: row.id },
    data: {
      shipMethod: method.trim(),
      tracking: tracking.trim(),
      updatedAt: new Date(),
    },
  });
  await enqueueSheetSync("rp", row.id);
}

export async function annaMarkReadyForLogistics(rpNum: string): Promise<void> {
  const row = await findRp(rpNum);
  await prisma.rpRequest.update({
    where: { id: row.id },
    data: {
      shipMethod: "Pallet",
      status: "Ready",
      readyMarkedAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await enqueueSheetSync("rp", row.id);
  void notifyAfterRpMutation(rpNum, "ready_marked");
}

export async function annaRevertReadyToActive(rpNum: string): Promise<void> {
  const row = await findRp(rpNum);
  if ((row.status ?? "").trim() !== "Ready") {
    throw new Error("Not ready");
  }
  await prisma.rpRequest.update({
    where: { id: row.id },
    data: {
      status: "Briefed",
      readyMarkedAt: null,
      updatedAt: new Date(),
    },
  });
  await enqueueSheetSync("rp", row.id);
  void notifyAfterRpMutation(rpNum, "ready_reverted");
}

export async function briefActiveUrgentPanel(
  rpNum: string,
  productionEta: string,
): Promise<void> {
  const row = await findRp(rpNum);
  await prisma.rpRequest.update({
    where: { id: row.id },
    data: {
      status: "In Production",
      dueDate: productionEta ? new Date(productionEta) : row.dueDate,
      updatedAt: new Date(),
    },
  });
  await enqueueSheetSync("rp", row.id);
  void notifyAfterRpMutation(rpNum, "status_changed");
}

export async function updateActiveUrgentPanelsEta(
  rpNum: string,
  newDate: string,
): Promise<void> {
  const row = await findRp(rpNum);
  await prisma.rpRequest.update({
    where: { id: row.id },
    data: {
      dueDate: newDate ? new Date(newDate) : null,
      updatedAt: new Date(),
    },
  });
  await enqueueSheetSync("rp", row.id);
  void notifyAfterRpMutation(rpNum, "status_changed");
}

export async function markActiveUrgentPanelReady(rpNum: string): Promise<void> {
  const row = await findRp(rpNum);
  const shipMethod = isUsaMarket(row.market) ? "Container" : "Pallet";
  await prisma.rpRequest.update({
    where: { id: row.id },
    data: {
      status: "Ready",
      shipMethod,
      readyMarkedAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await enqueueSheetSync("rp", row.id);
  void notifyAfterRpMutation(rpNum, "ready_marked");
}

export async function updateWorkshopNote(
  recordType: "rp" | "ip",
  recordNum: string,
  note: string,
): Promise<void> {
  if (recordType === "rp") {
    const row = await findRp(recordNum);
    await prisma.rpRequest.update({
      where: { id: row.id },
      data: { workshopNote: note.trim(), updatedAt: new Date() },
    });
    await enqueueSheetSync("rp", row.id);
    return;
  }
  const ip = await prisma.rpInternalProductionRow.findUnique({
    where: { ipNum: recordNum.trim() },
  });
  if (!ip) throw new Error("IP not found");
  await prisma.rpInternalProductionRow.update({
    where: { id: ip.id },
    data: { workshopNote: note.trim(), updatedAt: new Date() },
  });
  await enqueueSheetSync("ip", ip.id);
}

export async function updateDueDate(
  recordType: "rp" | "ip",
  recordNum: string,
  newDate: string,
  reason: string,
): Promise<void> {
  const due = newDate ? new Date(newDate) : null;
  if (recordType === "rp") {
    const row = await findRp(recordNum);
    const notes = [row.notes, reason].filter(Boolean).join(" — ");
    await prisma.rpRequest.update({
      where: { id: row.id },
      data: {
        dueDate: due,
        status: "Delayed",
        notes,
        updatedAt: new Date(),
      },
    });
    await enqueueSheetSync("rp", row.id);
    return;
  }
  const ip = await prisma.rpInternalProductionRow.findUnique({
    where: { ipNum: recordNum.trim() },
  });
  if (!ip) throw new Error("IP not found");
  const notes = [ip.notes, reason].filter(Boolean).join(" — ");
  await prisma.rpInternalProductionRow.update({
    where: { id: ip.id },
    data: {
      deadline: due,
      status: "Delayed",
      notes,
      updatedAt: new Date(),
    },
  });
  await enqueueSheetSync("ip", ip.id);
}
