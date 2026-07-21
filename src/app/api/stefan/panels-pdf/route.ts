import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import { getDashboardParts } from "@/lib/domain/dashboard-parts";
import { getIpDashboardCards } from "@/lib/domain/dashboard-ip";
import {
  allRowsHaveWorkshopNote,
  buildStefanPanelsPdf,
  partCardToStefanExportRow,
  type StefanPanelExportRow,
} from "@/lib/domain/stefan-panel-pdf";
import { resolveViewerContext } from "@/lib/viewer-context";

function ipCardToStefanRow(card: {
  ipNum: string;
  issue: string | null;
  factory: string | null;
  batch: string | null;
  model: string | null;
  color: string | null;
  clarification: string | null;
  panel: string | null;
  workshopNote: string | null;
  due: string | null;
}): StefanPanelExportRow {
  return {
    num: card.ipNum,
    issue: card.issue ?? "",
    payer: card.factory ?? "",
    boothId: card.batch ?? "",
    model: card.model ?? "",
    colour: card.color ?? "",
    clarifications: card.clarification ?? "",
    description: card.panel ?? "",
    workshopNote: card.workshopNote ?? "",
    due: card.due ?? "",
    market: "",
  };
}

export async function GET(request: Request) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  const viewer = await resolveViewerContext(authResult.session.user!.email!);
  if (viewer.role !== "stefan" && !viewer.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rpNums =
    url.searchParams.get("rpNums")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const ipNums =
    url.searchParams.get("ipNums")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (!rpNums.length && !ipNums.length) {
    return NextResponse.json({ error: "rpNums or ipNums required" }, { status: 400 });
  }

  const rows: StefanPanelExportRow[] = [];

  if (rpNums.length) {
    const parts = await getDashboardParts({ viewer, viewType: "active" });
    const selected = parts.filter((part) => rpNums.includes(part.rpNum));
    rows.push(...selected.map(partCardToStefanExportRow));
  }

  if (ipNums.length) {
    const ipCards = await getIpDashboardCards({
      factoryTokens: ["KAZ", "VAR", "AKS"],
      viewType: "active",
    });
    const selectedIp = ipCards.filter((c) => ipNums.includes(c.ipNum));
    rows.push(...selectedIp.map(ipCardToStefanRow));
  }

  if (!rows.length) {
    return NextResponse.json({ error: "No matching panels found" }, { status: 404 });
  }

  if (!allRowsHaveWorkshopNote(rows)) {
    return NextResponse.json(
      { error: "Въведи бележка цех за всички панели" },
      { status: 400 },
    );
  }

  const pdfBytes = await buildStefanPanelsPdf(rows);
  const fileName = `panels-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
