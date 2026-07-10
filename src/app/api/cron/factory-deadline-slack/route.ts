import { NextResponse } from "next/server";

import { gateCronOrRun } from "@/lib/cron-gate";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runFactoryDeadlineSlackSweep } from "@/lib/integrations/slack/rp-slack-bot";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await gateCronOrRun("factory_deadline_slack", () =>
      runFactoryDeadlineSlackSweep(),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("factory-deadline-slack cron failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
