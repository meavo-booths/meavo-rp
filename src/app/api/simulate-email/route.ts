import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import { assertAdmin } from "@/lib/domain/authz";
import { SIMULATE_COOKIE } from "@/lib/viewer-context";

export async function POST(request: Request) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  try {
    assertAdmin(authResult.session.user?.email);
    const body = (await request.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const jar = await cookies();

    if (!email) {
      jar.delete(SIMULATE_COOKIE);
      return NextResponse.json({ ok: true, simulatedEmail: null });
    }
    if (!email.endsWith("@meavo.com")) {
      return NextResponse.json(
        { error: "Simulation email must be @meavo.com" },
        { status: 400 },
      );
    }

    jar.set(SIMULATE_COOKIE, email, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return NextResponse.json({ ok: true, simulatedEmail: email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
