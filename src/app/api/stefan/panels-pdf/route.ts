import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import { getDashboardParts } from "@/lib/domain/dashboard-parts";
import {
  allRowsHaveWorkshopNote,
  buildStefanPanelsPdf,
  partCardToStefanExportRow,
} from "@/lib/domain/stefan-panel-pdf";
import { resolveViewerContext } from "@/lib/viewer-context";

export async function GET(request: Request) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  const viewer = await resolveViewerContext(authResult.session.user!.email!);
  if (viewer.role !== "stefan" && !viewer.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rpNums = url.searchParams.get("rpNums")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (!rpNums.length) {
    return NextResponse.json({ error: "rpNums required" }, { status: 400 });
  }

  const parts = await getDashboardParts({ viewer, viewType: "active" });
  const selected = parts.filter((part) => rpNums.includes(part.rpNum));
  if (!selected.length) {
    return NextResponse.json({ error: "No matching panels found" }, { status: 404 });
  }

  const rows = selected.map(partCardToStefanExportRow);
  if (!allRowsHaveWorkshopNote(rows)) {
    return NextResponse.json(
      { error: "Въведи бележка цех за всички панели" },
      { status: 400 },
    );
  }

  const pdfBytes = await buildStefanPanelsPdf(rows);
  const fileName = `KAZ-panels-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
