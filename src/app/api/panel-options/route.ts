import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import { getPanelOptionsByBoothModel } from "@/lib/reference-data/sheets";

export async function GET() {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  try {
    const options = await getPanelOptionsByBoothModel();
    return NextResponse.json(options);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load panel options";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
