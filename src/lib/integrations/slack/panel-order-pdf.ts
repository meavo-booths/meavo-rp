import {
  partCardToStefanExportRow,
  buildStefanPanelsPdf,
  allRowsHaveWorkshopNote,
  type StefanPanelExportRow,
} from "@/lib/domain/stefan-panel-pdf";
import type { PanelOrderEntry } from "@/lib/domain/panel-order-collect";

function entryToExportRow(entry: PanelOrderEntry): StefanPanelExportRow {
  return {
    num: entry.rpNum,
    issue: entry.issueType ?? "",
    payer: entry.factory,
    boothId: entry.boothId ?? "",
    model: entry.model ?? "",
    colour: entry.color ?? "",
    clarifications: entry.clarifications ?? "",
    description: entry.partDescription ?? entry.itemType ?? "",
    workshopNote: entry.workshopNote ?? "",
    due: entry.dueDate?.toISOString().slice(0, 10) ?? "",
    market: entry.market ?? "",
  };
}

export async function buildPanelOrderPdf(
  entries: PanelOrderEntry[],
  factoryGroup: "KAZ" | "VAR",
  fileNamePrefix: string,
): Promise<{ ok: true; fileName: string; pdfBytes: Uint8Array; exportNums: string[] } | { ok: false; message: string }> {
  if (!entries.length) {
    return { ok: false, message: "No panels to export." };
  }
  const rows = entries.map(entryToExportRow);
  if (!allRowsHaveWorkshopNote(rows)) {
    return { ok: false, message: "Missing workshop note on one or more panels." };
  }
  const title =
    factoryGroup === "KAZ"
      ? `KAZ панели — ${new Date().toLocaleDateString("bg-BG")}`
      : `VAR панели — ${new Date().toLocaleDateString("bg-BG")}`;
  const pdfBytes = await buildStefanPanelsPdf(rows, title);
  if (!pdfBytes.length) {
    return { ok: false, message: "PDF export produced an empty file." };
  }
  const fileName = `${fileNamePrefix}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return {
    ok: true,
    fileName,
    pdfBytes,
    exportNums: rows.map((r) => r.num),
  };
}

export { partCardToStefanExportRow };
