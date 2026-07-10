import { NextResponse } from "next/server";

import { gateCronOrRun } from "@/lib/cron-gate";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runRpSlackSweep } from "@/lib/integrations/slack/rp-slack-bot";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await gateCronOrRun("rp_slack", () => runRpSlackSweep());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("rp-slack cron failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
