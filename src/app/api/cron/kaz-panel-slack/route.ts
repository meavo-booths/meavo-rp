import { NextResponse } from "next/server";

import { gateCronOrRun } from "@/lib/cron-gate";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runKazPanelOrderSlack } from "@/lib/integrations/slack/kaz-var-slack";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await gateCronOrRun("kaz_panel_slack", () =>
      runKazPanelOrderSlack(),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("kaz-panel-slack cron failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
