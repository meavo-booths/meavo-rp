import { prisma } from "@/lib/prisma";
import { deduceFactoryFromBatch } from "@/lib/domain/stock-replacement";
import { enqueueSheetSync } from "@/lib/domain/panel-orders";

/** Daily sweep: fill missing reviewGroup from booth batch pattern. */
export async function runFactoryFillSweep(): Promise<{ updated: number }> {
  const rows = await prisma.rpRequest.findMany({
    where: {
      OR: [{ reviewGroup: null }, { reviewGroup: "" }],
      boothId: { not: null },
    },
    select: { id: true, boothId: true, status: true, itemType: true },
  });

  let updated = 0;
  for (const row of rows) {
    const factory = deduceFactoryFromBatch(row.boothId ?? "");
    if (!factory) continue;
    const status = (row.status ?? "").trim();
    const nextStatus =
      !status && (row.itemType ?? "").toUpperCase().includes("PANEL")
        ? "Briefed"
        : status || undefined;
    await prisma.rpRequest.update({
      where: { id: row.id },
      data: {
        reviewGroup: factory,
        ...(nextStatus ? { status: nextStatus } : {}),
        updatedAt: new Date(),
      },
    });
    await enqueueSheetSync("rp", row.id);
    updated++;
  }
  return { updated };
}
