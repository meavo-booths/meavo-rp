import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { RP_TOOL_CARD_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { resolveViewerContext } from "@/lib/viewer-context";

export async function requireApiSession() {
  const session = await auth();
  const email = session?.user?.email;
  const userId = session?.user?.id;
  if (!email || !userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const access = await prisma.toolCardAccess.findUnique({
    where: {
      userId_cardId: { userId, cardId: RP_TOOL_CARD_ID },
    },
  });
  if (!access) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const viewer = await resolveViewerContext(email);
  return { session, viewer };
}

/** For Server Actions — redirects instead of JSON errors. */
export async function requireActionSession() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");

  const access = await prisma.toolCardAccess.findUnique({
    where: {
      userId_cardId: {
        userId: session.user.id,
        cardId: RP_TOOL_CARD_ID,
      },
    },
  });
  if (!access) redirect("/login?error=NoAccess");

  const viewer = await resolveViewerContext(session.user.email);
  return { session, viewer };
}
