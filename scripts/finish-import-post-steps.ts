/**
 * Run backfill + sequence seed after RP sheet import (when IP tab import is skipped).
 */
import { config } from "dotenv";
import { resolve } from "node:path";

import { seedIpNumSequenceFromExisting } from "../src/lib/domain/ip-numbers";
import { backfillStockReplacementLinks } from "../src/lib/domain/rp-line-item-sync";
import { seedRpNumSequenceFromExisting } from "../src/lib/domain/rp-numbers";
import { prisma } from "../src/lib/prisma";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const backfill = await backfillStockReplacementLinks();
  console.log("stock links:", backfill);
  await seedIpNumSequenceFromExisting();
  await seedRpNumSequenceFromExisting();
  const rp = await prisma.rpRequest.count();
  const li = await prisma.rpLineItem.count();
  console.log("counts:", { rp, li });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
