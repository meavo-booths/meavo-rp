import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import { cancelRpRequest } from "@/lib/domain/rp-create";
import { normalizeRpNum } from "@/lib/domain/rp-numbers";

type RouteParams = { params: Promise<{ rpNum: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  const { rpNum: raw } = await params;
  const rpNum = normalizeRpNum(decodeURIComponent(raw));

  try {
    await cancelRpRequest(rpNum, authResult.viewer.effectiveEmail);
    return NextResponse.json({ status: "Cancelled" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel RP";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
