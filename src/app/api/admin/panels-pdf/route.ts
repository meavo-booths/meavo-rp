import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api/require-session";
import {
  adminPanelToExportRow,
  loadPanelExportRowsByNums,
} from "@/lib/domain/admin-dashboard";
import {
  allRowsHaveWorkshopNote,
  buildStefanPanelsPdf,
} from "@/lib/domain/stefan-panel-pdf";

export async function GET(request: Request) {
  const authResult = await requireApiSession();
  if ("error" in authResult) return authResult.error;

  const { viewer } = authResult;
  if (!viewer.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const factory = url.searchParams.get("factory")?.toUpperCase();
  if (factory !== "KAZ" && factory !== "VAR") {
    return NextResponse.json({ error: "factory=KAZ|VAR required" }, { status: 400 });
  }

  const rpNums =
    url.searchParams.get("rpNums")?.split(",").map((s) => s.trim()).filter(Boolean) ??
    [];
  const ipNums =
    url.searchParams.get("ipNums")?.split(",").map((s) => s.trim()).filter(Boolean) ??
    [];
  if (!rpNums.length && !ipNums.length) {
    return NextResponse.json({ error: "rpNums or ipNums required" }, { status: 400 });
  }

  const panels = await loadPanelExportRowsByNums(rpNums, ipNums);
  if (!panels.length) {
    return NextResponse.json({ error: "No matching panels found" }, { status: 404 });
  }

  const rows = panels.map(adminPanelToExportRow);
  if (!allRowsHaveWorkshopNote(rows)) {
    return NextResponse.json(
      { error: "Въведи бележка цех за всички панели" },
      { status: 400 },
    );
  }

  const dateLabel = new Date().toLocaleDateString("bg-BG");
  const pdfBytes = await buildStefanPanelsPdf(
    rows,
    `${factory} панели — ${dateLabel}`,
  );
  const fileName = `${factory}-panels-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
