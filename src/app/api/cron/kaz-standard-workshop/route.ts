import { NextResponse } from "next/server";

import { gateCronOrRun } from "@/lib/cron-gate";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runKazStandardWorkshopWarningSlack } from "@/lib/integrations/slack/kaz-var-slack";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await gateCronOrRun("kaz_panel_slack", () =>
      runKazStandardWorkshopWarningSlack(),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("kaz-standard-workshop cron failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
