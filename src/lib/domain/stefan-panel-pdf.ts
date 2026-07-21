import { readFile } from "fs/promises";
import path from "path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

import type { DashboardPartCard } from "@/lib/domain/dashboard-parts";

const HEADERS = [
  "Номер",
  "Проблем / Щета",
  "Платец",
  "ID",
  "Модел",
  "Цвят",
  "Бележка Търговци",
  "Описание",
  "Бележка цех",
  "Срок",
  "Държава",
] as const;

export type StefanPanelExportRow = {
  num: string;
  issue: string;
  payer: string;
  boothId: string;
  model: string;
  colour: string;
  clarifications: string;
  description: string;
  workshopNote: string;
  due: string;
  market: string;
};

export function partCardToStefanExportRow(
  part: DashboardPartCard,
): StefanPanelExportRow {
  return {
    num: part.rpNum,
    issue: part.issueType ?? "",
    payer: part.payer ?? "",
    boothId: part.boothId ?? "",
    model: part.model ?? "",
    colour: part.color ?? "",
    clarifications: part.clarifications ?? "",
    description: part.partDescription ?? "",
    workshopNote: part.workshopNote ?? "",
    due: part.dueDate ?? "",
    market: part.market ?? "",
  };
}

export function allRowsHaveWorkshopNote(rows: StefanPanelExportRow[]): boolean {
  return rows.every((row) => row.workshopNote.trim().length > 0);
}

function truncate(text: string, max: number): string {
  const value = text.trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

async function loadPdfFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  const fontsDir = path.join(process.cwd(), "src/lib/fonts");
  const [regular, bold] = await Promise.all([
    readFile(path.join(fontsDir, "LiberationSans-Regular.ttf")),
    readFile(path.join(fontsDir, "LiberationSans-Bold.ttf")),
  ]);
  return { regular, bold };
}

export async function buildStefanPanelsPdf(
  rows: StefanPanelExportRow[],
  exportTitle?: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontFiles = await loadPdfFonts();
  const font = await pdf.embedFont(fontFiles.regular, { subset: true });
  const fontBold = await pdf.embedFont(fontFiles.bold, { subset: true });

  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 28;
  const rowHeight = 14;
  const headerHeight = 18;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const title =
    exportTitle?.trim() ||
    `KAZ панели — ${new Date().toLocaleDateString("bg-BG")}`;
  page.drawText(title, {
    x: margin,
    y: y - 12,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 28;

  const colWidths = [40, 72, 48, 70, 52, 62, 88, 72, 148, 62, 58];
  let x = margin;

  for (let h = 0; h < HEADERS.length; h++) {
    page.drawRectangle({
      x,
      y: y - headerHeight,
      width: colWidths[h],
      height: headerHeight,
      color: rgb(0.85, 0.85, 0.85),
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.5,
    });
    page.drawText(truncate(HEADERS[h], 18), {
      x: x + 2,
      y: y - 13,
      size: 7,
      font: fontBold,
    });
    x += colWidths[h];
  }
  y -= headerHeight;

  const valuesForRow = (row: StefanPanelExportRow) => [
    row.num,
    row.issue,
    row.payer,
    row.boothId,
    row.model,
    row.colour,
    row.clarifications,
    row.description,
    row.workshopNote,
    row.due,
    row.market,
  ];

  for (const row of rows) {
    if (y < margin + rowHeight) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    x = margin;
    const cells = valuesForRow(row);
    for (let c = 0; c < cells.length; c++) {
      page.drawRectangle({
        x,
        y: y - rowHeight,
        width: colWidths[c],
        height: rowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.25,
      });
      page.drawText(truncate(cells[c], c === 8 ? 42 : 22), {
        x: x + 2,
        y: y - 11,
        size: 6.5,
        font,
      });
      x += colWidths[c];
    }
    y -= rowHeight;
  }

  return pdf.save();
}
