import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/** Unbriefed urgent panel escalations — port from UnbriefedUrgentPanelSlackBot.js */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, message: "unbriefed-panels stub" });
}
