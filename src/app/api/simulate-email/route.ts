import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import { assertAdmin } from "@/lib/domain/authz";
import { SIMULATE_COOKIE } from "@/lib/viewer-context";

/**
 * Legacy API — clears the old shared simulate cookie.
 * Prefer `?as=` + sessionStorage (per-tab) via the Simulate UI.
 */
export async function POST(request: Request) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  try {
    assertAdmin(authResult.session.user?.email);
    const body = (await request.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const jar = await cookies();

    // Always drop the shared cookie so tabs no longer fight over one persona.
    jar.delete(SIMULATE_COOKIE);

    if (!email) {
      return NextResponse.json({ ok: true, simulatedEmail: null });
    }
    if (!email.endsWith("@meavo.com")) {
      return NextResponse.json(
        { error: "Simulation email must be @meavo.com" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      simulatedEmail: email,
      hint: "Use ?as= in the URL for per-tab simulation",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
