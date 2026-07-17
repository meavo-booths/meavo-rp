import type { RpInternalProductionRow, RpRequest } from "@prisma/client";

import {
  ipRowToSheetRow,
  rpRequestToSheetRow,
} from "@/lib/integrations/sheet-row-mapper";
import {
  IP_COLUMN,
  RP_COLUMN,
} from "@/lib/integrations/rp-sheet-columns";
import { prisma } from "@/lib/prisma";

export type NeonSheetTab = "rp" | "ip";

export type NeonSheetColumn = {
  key: string;
  letter: string;
  label: string;
};

/** Spreadsheet letters for compare-with-sheet view (skip photo column). */
export const NEON_RP_SHEET_COLUMNS: NeonSheetColumn[] = [
  { key: "RP_NUM", letter: "A", label: "RP Num" },
  { key: "ENTRY_DATE", letter: "B", label: "Entry date" },
  { key: "DUE_DATE", letter: "C", label: "Due date" },
  { key: "MARKET", letter: "D", label: "Market" },
  { key: "USER_ID", letter: "E", label: "User ID" },
  { key: "ISSUE_TYPE", letter: "F", label: "Issue type" },
  { key: "URGENCY", letter: "G", label: "Urgency" },
  { key: "MODEL", letter: "H", label: "Model" },
  { key: "BOOTH_ID", letter: "I", label: "Booth ID" },
  { key: "COLOR", letter: "J", label: "Color" },
  { key: "ITEM_TYPE", letter: "K", label: "Part/Module" },
  { key: "QUANTITY", letter: "L", label: "Qty" },
  { key: "PART_RP_CODE", letter: "M", label: "Part RP code" },
  { key: "PART_DESCRIPTION", letter: "N", label: "Description" },
  { key: "CLARIFICATIONS", letter: "O", label: "Clarifications" },
  { key: "NOTES", letter: "P", label: "Notes" },
  { key: "CLIENT", letter: "Q", label: "Client" },
  { key: "ADDRESS", letter: "R", label: "Address" },
  { key: "RECIPIENT", letter: "S", label: "Recipient" },
  { key: "PHONE", letter: "T", label: "Phone" },
  { key: "EMAIL", letter: "U", label: "Email" },
  { key: "REVIEW_GROUP", letter: "V", label: "Review group" },
  { key: "SHIP_METHOD", letter: "W", label: "Ship method" },
  { key: "STATUS", letter: "X", label: "Status" },
  { key: "TRACKING", letter: "Y", label: "Tracking" },
  { key: "READY_MARKED", letter: "Z", label: "Ready marked" },
  { key: "PAYER", letter: "AA", label: "Payer" },
  { key: "CURRENT_LOCATION", letter: "AB", label: "Location" },
  { key: "WORKSHOP_NOTE", letter: "AD", label: "Workshop note" },
  { key: "ORDER_SENT", letter: "AE", label: "Order sent" },
];

export const NEON_IP_SHEET_COLUMNS: NeonSheetColumn[] = [
  { key: "IP_NUM", letter: "A", label: "IP Num" },
  { key: "ENTRY_DATE", letter: "B", label: "Date" },
  { key: "DEADLINE", letter: "C", label: "Deadline" },
  { key: "OWNER_EMAIL", letter: "D", label: "Owner" },
  { key: "REASON", letter: "E", label: "Reason" },
  { key: "URGENCY", letter: "F", label: "Urgency" },
  { key: "MODEL", letter: "G", label: "Model" },
  { key: "BATCH", letter: "H", label: "Batch" },
  { key: "COLOUR", letter: "I", label: "Colour" },
  { key: "PANEL", letter: "J", label: "Panel" },
  { key: "PANEL_CLARIFICATION", letter: "K", label: "Clarification" },
  { key: "NOTES", letter: "L", label: "Notes" },
  { key: "WAREHOUSE", letter: "M", label: "Warehouse" },
  { key: "FACTORY", letter: "N", label: "Factory" },
  { key: "STATUS", letter: "P", label: "Status" },
  { key: "TRACKING", letter: "Q", label: "Tracking" },
  { key: "PAYER", letter: "R", label: "Payer" },
  { key: "SOURCE_RP", letter: "S", label: "Source RP" },
  { key: "WORKSHOP_NOTE", letter: "T", label: "Workshop note" },
  { key: "ORDER_SENT", letter: "U", label: "Order sent" },
];

function cellAt(
  row: string[],
  columnKey: string,
  tab: NeonSheetTab,
): string {
  const map = tab === "rp" ? RP_COLUMN : IP_COLUMN;
  const idx = map[columnKey as keyof typeof map];
  if (typeof idx !== "number") return "";
  return row[idx] ?? "";
}

export type NeonSheetTableRow = {
  id: string;
  cells: string[];
};

export type NeonSheetPage = {
  tab: NeonSheetTab;
  columns: NeonSheetColumn[];
  rows: NeonSheetTableRow[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
};

const DEFAULT_PAGE_SIZE = 50;

function matchesSearch(cells: string[], search: string): boolean {
  if (!search) return true;
  const q = search.toLowerCase();
  return cells.some((c) => c.toLowerCase().includes(q));
}

function sortRp(a: RpRequest, b: RpRequest): number {
  const an = Number(String(a.rpNum).replace(/\D/g, "")) || 0;
  const bn = Number(String(b.rpNum).replace(/\D/g, "")) || 0;
  return bn - an;
}

function sortIp(a: RpInternalProductionRow, b: RpInternalProductionRow): number {
  const an = Number(String(a.ipNum).replace(/\D/g, "")) || 0;
  const bn = Number(String(b.ipNum).replace(/\D/g, "")) || 0;
  return bn - an;
}

export async function getNeonSheetPage(options: {
  tab?: NeonSheetTab;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<NeonSheetPage> {
  const tab: NeonSheetTab = options.tab === "ip" ? "ip" : "rp";
  const search = (options.search ?? "").trim();
  const pageSize = Math.min(
    Math.max(options.pageSize ?? DEFAULT_PAGE_SIZE, 10),
    200,
  );
  const page = Math.max(options.page ?? 1, 1);
  const columns = tab === "rp" ? NEON_RP_SHEET_COLUMNS : NEON_IP_SHEET_COLUMNS;

  if (tab === "rp") {
    const all = await prisma.rpRequest.findMany();
    all.sort(sortRp);
    const mapped = all.map((row) => {
      const sheet = rpRequestToSheetRow(row);
      const cells = columns.map((col) => cellAt(sheet, col.key, "rp"));
      return { id: row.id, cells, _match: matchesSearch(cells, search) };
    });
    const filtered = mapped.filter((r) => r._match);
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const rows = filtered.slice(start, start + pageSize).map(({ id, cells }) => ({
      id,
      cells,
    }));
    return { tab, columns, rows, total, page, pageSize, search };
  }

  const all = await prisma.rpInternalProductionRow.findMany();
  all.sort(sortIp);
  const mapped = all.map((row) => {
    const sheet = ipRowToSheetRow(row);
    const cells = columns.map((col) => cellAt(sheet, col.key, "ip"));
    return { id: row.id, cells, _match: matchesSearch(cells, search) };
  });
  const filtered = mapped.filter((r) => r._match);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize).map(({ id, cells }) => ({
    id,
    cells,
  }));
  return { tab, columns, rows, total, page, pageSize, search };
}
