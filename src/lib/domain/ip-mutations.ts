import { enqueueSheetSync } from "@/lib/domain/panel-orders";
import { recordLifecycleEvent } from "@/lib/domain/lifecycle-events";
import { prisma } from "@/lib/prisma";

async function findIp(ipNum: string) {
  const row = await prisma.rpInternalProductionRow.findUnique({
    where: { ipNum: ipNum.trim() },
  });
  if (!row) throw new Error("IP not found");
  return row;
}

function assertFactory(row: { factory: string | null }, allowed: string[]): void {
  const factory = (row.factory ?? "").trim().toUpperCase();
  const ok = allowed.some((token) => factory.includes(token));
  if (!ok) throw new Error("Access denied for this factory");
}

export async function nikolayMarkIpReadyForWarehouse(
  ipNum: string,
  actorEmail?: string | null,
): Promise<void> {
  const row = await findIp(ipNum);
  assertFactory(row, ["AKS"]);
  const status = (row.status ?? "").trim();
  if (status === "Ready") return;
  if (status === "Cancelled" || status === "Shipped") {
    throw new Error(`Cannot mark ready from status: ${status}`);
  }
  await prisma.rpInternalProductionRow.update({
    where: { id: row.id },
    data: { status: "Ready", updatedAt: new Date() },
  });
  await recordLifecycleEvent({
    entityType: "ip",
    entityId: row.id,
    eventType: "ready_marked",
    fromStatus: row.status,
    toStatus: "Ready",
    actorEmail,
  });
  await enqueueSheetSync("ip", row.id);
}

export async function stefanMarkIpReadyForWarehouse(
  ipNum: string,
  actorEmail?: string | null,
): Promise<void> {
  const row = await findIp(ipNum);
  assertFactory(row, ["KAZ"]);
  const status = (row.status ?? "").trim();
  if (status === "Ready") return;
  if (status === "Cancelled" || status === "Shipped") {
    throw new Error(`Cannot mark ready from status: ${status}`);
  }
  await prisma.rpInternalProductionRow.update({
    where: { id: row.id },
    data: { status: "Ready", updatedAt: new Date() },
  });
  await recordLifecycleEvent({
    entityType: "ip",
    entityId: row.id,
    eventType: "ready_marked",
    fromStatus: row.status,
    toStatus: "Ready",
    actorEmail,
  });
  await enqueueSheetSync("ip", row.id);
}

export async function todorMarkIpDeliveredAtTopoli(
  ipNum: string,
  actorEmail?: string | null,
): Promise<void> {
  const row = await findIp(ipNum);
  const warehouse = (row.warehouse ?? "").trim().toLowerCase();
  if (!warehouse.includes("topoli")) {
    throw new Error("IP is not at Topoli warehouse");
  }
  const status = (row.status ?? "").trim();
  if (status === "Delivered") return;
  await prisma.rpInternalProductionRow.update({
    where: { id: row.id },
    data: { status: "Delivered", updatedAt: new Date() },
  });
  await recordLifecycleEvent({
    entityType: "ip",
    entityId: row.id,
    eventType: "delivered",
    fromStatus: row.status,
    toStatus: "Delivered",
    actorEmail,
  });
  await enqueueSheetSync("ip", row.id);
}
