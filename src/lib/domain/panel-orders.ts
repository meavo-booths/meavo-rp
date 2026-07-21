import type { DbExecutor } from "@/lib/db/executor";
import { isSheetSyncForceOff } from "@/lib/env";
import { recordLifecycleEvent } from "@/lib/domain/lifecycle-events";
import { prisma } from "@/lib/prisma";

export async function enqueueSheetSync(
  entityType: "rp" | "ip",
  entityId: string,
  operation: "upsert" | "delete" = "upsert",
  executor: DbExecutor = prisma,
): Promise<void> {
  if (isSheetSyncForceOff()) return;
  await executor.rpSheetSyncOutbox.create({
    data: {
      entityType,
      entityId,
      operation,
      status: "pending",
    },
  });
}

export async function isPanelOrderSent(
  orderSentAt: Date | null | undefined,
): Promise<boolean> {
  return orderSentAt != null;
}

export async function markPanelOrderSent(
  rpId: string,
  actorEmail?: string | null,
): Promise<void> {
  const now = new Date();
  await prisma.rpRequest.update({
    where: { id: rpId },
    data: { orderSentAt: now, updatedAt: now },
  });
  await recordLifecycleEvent({
    entityType: "rp",
    entityId: rpId,
    eventType: "order_sent",
    actorEmail,
  });
  await enqueueSheetSync("rp", rpId);
}
