import { prisma } from "@/lib/prisma";

const TTL_MS = 5 * 60 * 1000;

type SubmitKind = "rp" | "ip";

const KEY_PREFIX: Record<SubmitKind, string> = {
  rp: "LOGGER_SUBMIT_",
  ip: "IP_LOGGER_SUBMIT_",
};

type CachedPayload = {
  nums: string[];
  at: number;
  status?: "pending" | "done";
};

function parsePayload(value: string): CachedPayload | null {
  try {
    const parsed = JSON.parse(value) as CachedPayload;
    if (!parsed || typeof parsed.at !== "number") return null;
    return {
      nums: Array.isArray(parsed.nums) ? parsed.nums : [],
      at: parsed.at,
      status: parsed.status,
    };
  } catch {
    return null;
  }
}

function isFresh(at: number): boolean {
  return Date.now() - at <= TTL_MS;
}

async function readRow(kind: SubmitKind, submitKey: string) {
  const key = KEY_PREFIX[kind] + submitKey.trim();
  if (!submitKey.trim()) return null;
  return prisma.rpAutomationState.findUnique({ where: { key } });
}

export type SubmitClaimResult =
  | { kind: "hit"; nums: string[] }
  | { kind: "claimed" }
  | { kind: "busy" };

/**
 * Claim a submit key before creating records.
 * Prevents two parallel requests with the same key from both minting new RPs/IPs.
 */
export async function claimSubmitKey(
  kind: SubmitKind,
  submitKey: string,
): Promise<SubmitClaimResult> {
  if (!submitKey.trim()) return { kind: "claimed" };

  const key = KEY_PREFIX[kind] + submitKey.trim();
  const existing = await prisma.rpAutomationState.findUnique({ where: { key } });
  if (existing?.value) {
    const parsed = parsePayload(existing.value);
    if (parsed && isFresh(parsed.at)) {
      if (parsed.nums.length) return { kind: "hit", nums: parsed.nums };
      if (parsed.status === "pending") return { kind: "busy" };
    } else {
      await prisma.rpAutomationState.delete({ where: { key } }).catch(() => {});
    }
  }

  try {
    await prisma.rpAutomationState.create({
      data: {
        key,
        value: JSON.stringify({
          nums: [],
          status: "pending",
          at: Date.now(),
        } satisfies CachedPayload),
      },
    });
    return { kind: "claimed" };
  } catch {
    const again = await prisma.rpAutomationState.findUnique({ where: { key } });
    const parsed = again?.value ? parsePayload(again.value) : null;
    if (parsed && isFresh(parsed.at) && parsed.nums.length) {
      return { kind: "hit", nums: parsed.nums };
    }
    return { kind: "busy" };
  }
}

export async function completeSubmitKey(
  kind: SubmitKind,
  submitKey: string,
  nums: string[],
): Promise<void> {
  const key = KEY_PREFIX[kind] + submitKey.trim();
  if (!submitKey.trim() || !nums.length) return;
  await prisma.rpAutomationState.upsert({
    where: { key },
    create: {
      key,
      value: JSON.stringify({
        nums,
        status: "done",
        at: Date.now(),
      } satisfies CachedPayload),
    },
    update: {
      value: JSON.stringify({
        nums,
        status: "done",
        at: Date.now(),
      } satisfies CachedPayload),
      updatedAt: new Date(),
    },
  });
}

export async function releaseSubmitKey(
  kind: SubmitKind,
  submitKey: string,
): Promise<void> {
  const key = KEY_PREFIX[kind] + submitKey.trim();
  if (!submitKey.trim()) return;
  const row = await prisma.rpAutomationState.findUnique({ where: { key } });
  if (!row?.value) return;
  const parsed = parsePayload(row.value);
  if (parsed?.status === "pending" && !parsed.nums.length) {
    await prisma.rpAutomationState.delete({ where: { key } }).catch(() => {});
  }
}

/** @deprecated Prefer claimSubmitKey + completeSubmitKey */
export async function getCachedLoggerSubmitResult(
  submitKey: string,
): Promise<string | null> {
  const row = await readRow("rp", submitKey);
  if (!row?.value) return null;
  const parsed = parsePayload(row.value);
  if (!parsed || !isFresh(parsed.at) || !parsed.nums.length) return null;
  return parsed.nums.join(",");
}

/** @deprecated Prefer claimSubmitKey + completeSubmitKey */
export async function cacheLoggerSubmitResult(
  submitKey: string,
  rpNums: string[],
): Promise<void> {
  await completeSubmitKey("rp", submitKey, rpNums);
}

/** @deprecated Prefer claimSubmitKey + completeSubmitKey */
export async function getCachedIpSubmitResult(
  submitKey: string,
): Promise<string[] | null> {
  const row = await readRow("ip", submitKey);
  if (!row?.value) return null;
  const parsed = parsePayload(row.value);
  if (!parsed || !isFresh(parsed.at) || !parsed.nums.length) return null;
  return parsed.nums;
}

/** @deprecated Prefer claimSubmitKey + completeSubmitKey */
export async function cacheIpSubmitResult(
  submitKey: string,
  ipNums: string[],
): Promise<void> {
  await completeSubmitKey("ip", submitKey, ipNums);
}
