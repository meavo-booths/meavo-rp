import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { RP_TOOL_CARD_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function requireRpAccess() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (session.user.rpAccess) return session;

  const access = await prisma.toolCardAccess.findFirst({
    where: { userId: session.user.id, cardId: RP_TOOL_CARD_ID },
  });

  if (!access) redirect("/login?error=NoAccess");

  return session;
}
