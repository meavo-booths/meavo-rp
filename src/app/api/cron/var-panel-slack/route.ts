import { NextResponse } from "next/server";

import { gateCronOrRun } from "@/lib/cron-gate";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runVarPanelOrderSlack } from "@/lib/integrations/slack/kaz-var-slack";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await gateCronOrRun("var_panel_slack", () =>
      runVarPanelOrderSlack(),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("var-panel-slack cron failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
