/**
 * One-shot: recompute RpRequest.payer from the sheet formula for all rows
 * that are not manually locked (payerManual = false).
 *
 * Usage:
 *   npx vercel env run -e production -- npx tsx scripts/backfill-rp-payer.ts
 *   # or with local DATABASE_URL:
 *   npx tsx scripts/backfill-rp-payer.ts
 */
import "dotenv/config";

import { autoPayerUpdate } from "../src/lib/domain/rp-payer";
import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.rpRequest.findMany({
    select: {
      id: true,
      rpNum: true,
      issueType: true,
      reviewGroup: true,
      itemType: true,
      quantity: true,
      partRpCode: true,
      partDescription: true,
      clarifications: true,
      payer: true,
      payerManual: true,
    },
  });

  let updated = 0;
  let skippedManual = 0;

  for (const row of rows) {
    if (row.payerManual) {
      skippedManual++;
      continue;
    }
    const patch = autoPayerUpdate(row);
    if (!patch) continue;
    await prisma.rpRequest.update({
      where: { id: row.id },
      data: { payer: patch.payer, updatedAt: new Date() },
    });
    updated++;
  }

  console.log(
    `payer backfill done: updated=${updated} skippedManual=${skippedManual} total=${rows.length}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
