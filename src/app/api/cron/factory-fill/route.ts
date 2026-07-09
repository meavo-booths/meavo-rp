import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runFactoryFillSweep } from "@/lib/domain/factory-fill";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runFactoryFillSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("factory-fill cron failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
