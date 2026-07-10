import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import { lookupStandardPartnerYes } from "@/lib/reference-data/catalogue";
import { lookupSparePartFromRepSheet } from "@/lib/reference-data/sheets";

type RouteParams = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  const { code } = await params;
  const decoded = decodeURIComponent(code);
  const [result, standardPartnerYes] = await Promise.all([
    lookupSparePartFromRepSheet(decoded),
    lookupStandardPartnerYes(decoded),
  ]);
  return NextResponse.json({ ...result, standardPartnerYes });
}
