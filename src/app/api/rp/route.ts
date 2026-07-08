import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import type { LoggerFormInput } from "@/lib/domain/rp-form-mapper";
import { processNewRpEntry } from "@/lib/domain/rp-create";

export async function POST(request: Request) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  try {
    const body = (await request.json()) as LoggerFormInput;
    const result = await processNewRpEntry(body, authResult.viewer.effectiveEmail);
    return NextResponse.json({
      status: "Success",
      rpNum: result.rpNums[0],
      rpNums: result.rpNums,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create RP";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
