import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/** KAZ/VAR panel order Slack automations — port from KazPanelOrderSlackAutomation.js */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, message: "kaz-panel-slack stub" });
}
