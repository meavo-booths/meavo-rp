import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import {
  getDashboardParts,
  type PartsViewType,
} from "@/lib/domain/dashboard-parts";
import { normalizeRegionalScopeRequest } from "@/lib/domain/standard-regional-scopes";

export async function GET(request: Request) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  const url = new URL(request.url);
  const viewType = (url.searchParams.get("view") ?? "active") as PartsViewType;
  const search = url.searchParams.get("q") ?? undefined;
  const regionalScope = normalizeRegionalScopeRequest(
    authResult.viewer.effectiveEmail,
    url.searchParams.get("scope"),
  );

  try {
    const parts = await getDashboardParts({
      viewer: authResult.viewer,
      viewType,
      search,
      regionalScope: regionalScope || undefined,
    });
    return NextResponse.json({ parts, viewer: authResult.viewer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
