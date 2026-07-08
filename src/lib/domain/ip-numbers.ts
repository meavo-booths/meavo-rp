import type { DbExecutor } from "@/lib/db/executor";
import { prisma } from "@/lib/prisma";

const IP_SEQUENCE_ID = "default";

/** Mint the next IP label (IP-123), mirroring buildNextIpLabel_ in GAS. */
export async function mintNextIpNum(executor: DbExecutor = prisma): Promise<string> {
  const row = await executor.rpIpNumSequence.upsert({
    where: { id: IP_SEQUENCE_ID },
    create: { id: IP_SEQUENCE_ID, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `IP-${row.lastValue}`;
}

/** Seed IP sequence from existing rows (import). */
export async function seedIpNumSequenceFromExisting(): Promise<void> {
  const rows = await prisma.rpInternalProductionRow.findMany({
    select: { ipNum: true },
  });

  let max = 0;
  for (const row of rows) {
    const match = row.ipNum.match(/IP-(\d+)/i);
    if (match) {
      const num = Number(match[1]);
      if (!Number.isNaN(num) && num > max) max = num;
    }
  }

  if (max > 0) {
    await prisma.rpIpNumSequence.upsert({
      where: { id: IP_SEQUENCE_ID },
      create: { id: IP_SEQUENCE_ID, lastValue: max },
      update: { lastValue: max },
    });
  }
}
