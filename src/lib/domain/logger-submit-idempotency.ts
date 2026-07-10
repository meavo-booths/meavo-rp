import { prisma } from "@/lib/prisma";

const KEY_PREFIX = "LOGGER_SUBMIT_";
const TTL_MS = 5 * 60 * 1000;

export async function getCachedLoggerSubmitResult(
  submitKey: string,
): Promise<string | null> {
  const key = KEY_PREFIX + submitKey.trim();
  if (!key || key === KEY_PREFIX) return null;
  const row = await prisma.rpAutomationState.findUnique({ where: { key } });
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value) as { rpNums: string[]; at: number };
    if (Date.now() - parsed.at > TTL_MS) {
      await prisma.rpAutomationState.delete({ where: { key } }).catch(() => {});
      return null;
    }
    return parsed.rpNums.join(",");
  } catch {
    return null;
  }
}

export async function cacheLoggerSubmitResult(
  submitKey: string,
  rpNums: string[],
): Promise<void> {
  const key = KEY_PREFIX + submitKey.trim();
  if (!key || key === KEY_PREFIX || !rpNums.length) return;
  await prisma.rpAutomationState.upsert({
    where: { key },
    create: {
      key,
      value: JSON.stringify({ rpNums, at: Date.now() }),
    },
    update: {
      value: JSON.stringify({ rpNums, at: Date.now() }),
      updatedAt: new Date(),
    },
  });
}
