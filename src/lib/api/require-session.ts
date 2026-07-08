import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { resolveViewerContext } from "@/lib/viewer-context";

export async function requireApiSession() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const viewer = await resolveViewerContext(email);
  return { session, viewer };
}
