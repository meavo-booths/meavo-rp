import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { processSheetSyncOutbox } from "@/lib/integrations/sheet-sync";

/** Processes sheet_sync_outbox → Rep.Parts26 backup. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processSheetSyncOutbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("sheet-sync cron failed:", error);
    return NextResponse.json({ error: "Sheet sync failed" }, { status: 500 });
  }
}
