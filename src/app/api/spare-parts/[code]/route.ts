import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import { lookupSparePartFromRepSheet } from "@/lib/reference-data/sheets";

type RouteParams = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  const { code } = await params;
  const result = await lookupSparePartFromRepSheet(decodeURIComponent(code));
  return NextResponse.json(result);
}
