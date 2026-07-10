import { NextResponse } from "next/server";

import { gateCronOrRun } from "@/lib/cron-gate";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runUnbriefedUrgentPanelsCheck } from "@/lib/integrations/slack/unbriefed-slack";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await gateCronOrRun("unbriefed_slack", () =>
      runUnbriefedUrgentPanelsCheck(),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("unbriefed-panels cron failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
