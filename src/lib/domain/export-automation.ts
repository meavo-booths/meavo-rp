import { prisma } from "@/lib/prisma";
import { enqueueSheetSync } from "@/lib/domain/panel-orders";

/**
 * Apply export tracking text from RpExportTrackingRow to RP tracking column.
 * Port of ExportAutomation.js (simplified).
 */
export async function runExportStatusSync(): Promise<{ synced: number }> {
  const tracking = await prisma.rpExportTrackingRow.findMany({ take: 100 });

  let synced = 0;
  for (const t of tracking) {
    const rp = await prisma.rpRequest.findUnique({
      where: { rpNum: t.rpNum },
    });
    if (!rp || !t.trackingText) continue;
    if ((rp.tracking ?? "") === t.trackingText) continue;

    await prisma.rpRequest.update({
      where: { id: rp.id },
      data: {
        tracking: t.trackingText,
        status: rp.status === "Ready" ? "Shipped" : rp.status,
        updatedAt: new Date(),
      },
    });
    await enqueueSheetSync("rp", rp.id);
    synced++;
  }
  return { synced };
}
