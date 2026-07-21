"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActionSession } from "@/lib/api/require-session";
import { isAdminUser } from "@/lib/domain/authz";
import { markPanelOrderEntriesSent } from "@/lib/domain/panel-order-collect";
import type { PanelOrderEntry } from "@/lib/domain/panel-order-collect";
import { prisma } from "@/lib/prisma";

export type ActionResult = { error?: string; marked?: number };

function revalidateAdminPaths() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard/stefan");
}

export async function markAdminPanelsSentAction(input: {
  rpNums: string[];
  ipNums: string[];
}): Promise<ActionResult> {
  const session = await requireActionSession();
  const email = session.session.user?.email;
  if (!email || !isAdminUser(email)) {
    return { error: "Forbidden" };
  }

  const rpNums = [...new Set(input.rpNums.map((n) => n.trim()).filter(Boolean))];
  const ipNums = [...new Set(input.ipNums.map((n) => n.trim()).filter(Boolean))];
  if (!rpNums.length && !ipNums.length) {
    return { error: "No panels selected" };
  }

  const entries: PanelOrderEntry[] = [];

  if (rpNums.length) {
    const rows = await prisma.rpRequest.findMany({
      where: { rpNum: { in: rpNums } },
    });
    for (const row of rows) {
      if (row.orderSentAt) continue;
      entries.push({
        recordType: "rp",
        recordId: row.id,
        rpNum: row.rpNum,
        factory: row.reviewGroup ?? "",
        urgency: row.urgency,
        status: row.status,
        workshopNote: row.workshopNote,
      });
    }
  }

  if (ipNums.length) {
    const rows = await prisma.rpInternalProductionRow.findMany({
      where: { ipNum: { in: ipNums } },
    });
    for (const row of rows) {
      if (row.orderSentAt) continue;
      entries.push({
        recordType: "ip",
        recordId: row.id,
        rpNum: row.ipNum,
        sourceRp: row.sourceRpNum,
        factory: row.factory ?? "",
        urgency: row.urgency,
        status: row.status,
        workshopNote: row.workshopNote,
      });
    }
  }

  if (!entries.length) {
    return { error: "No unsent panels found for selection" };
  }

  await markPanelOrderEntriesSent(entries);
  revalidateAdminPaths();
  return { marked: entries.length };
}

export async function requireAdminPage() {
  const { session, viewer } = await requireActionSession();
  const email = session.user?.email;
  if (!email || !isAdminUser(email)) redirect("/dashboard");
  return { session, viewer };
}
