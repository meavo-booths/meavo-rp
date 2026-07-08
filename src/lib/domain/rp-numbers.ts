import type { DbExecutor } from "@/lib/db/executor";
import { prisma } from "@/lib/prisma";

const RP_SEQUENCE_ID = "default";

export function normalizeRpNum(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  const match = raw.match(/RP-(\d+)/i);
  if (match) return `RP-${Number(match[1])}`;
  if (/^\d+$/.test(raw)) return `RP-${Number(raw)}`;
  return raw;
}

/** Mint the next RP label (RP-123), mirroring buildNextRpLabel_ in GAS. */
export async function mintNextRpNum(executor: DbExecutor = prisma): Promise<string> {
  const row = await executor.rpNumSequence.upsert({
    where: { id: RP_SEQUENCE_ID },
    create: { id: RP_SEQUENCE_ID, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `RP-${row.lastValue}`;
}

export async function seedRpNumSequenceFromExisting(): Promise<void> {
  const rows = await prisma.rpRequest.findMany({ select: { rpNum: true } });
  let max = 0;
  for (const row of rows) {
    const match = row.rpNum.match(/RP-(\d+)/i);
    if (match) {
      const num = Number(match[1]);
      if (!Number.isNaN(num) && num > max) max = num;
    }
  }
  if (max > 0) {
    await prisma.rpNumSequence.upsert({
      where: { id: RP_SEQUENCE_ID },
      create: { id: RP_SEQUENCE_ID, lastValue: max },
      update: { lastValue: max },
    });
  }
}
