import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runExportStatusSync } from "@/lib/domain/export-automation";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runExportStatusSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("export-sync cron failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
