import type { RpInternalProductionRow, RpRequest } from "@prisma/client";
import { resolveWorkshopNoteForSheetSync } from "@/lib/domain/rp-header-stock";
import {
  IP_COLUMN,
  IP_LAST_COLUMN,
  RP_COLUMN,
  RP_LAST_COLUMN,
} from "@/lib/integrations/rp-sheet-columns";
import { getDateKeyInScriptTz } from "@/lib/integrations/slack/script-timezone";

type RpRow = RpRequest;
type IpRow = RpInternalProductionRow;

function padRow(values: string[], lastCol: number): string[] {
  const row = new Array<string>(lastCol + 1).fill("");
  for (let i = 0; i < values.length && i <= lastCol; i++) {
    row[i] = values[i] ?? "";
  }
  return row;
}

/** Calendar date in Europe/Sofia — never UTC via toISOString (shifts the day). */
function formatDate(value: Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return getDateKeyInScriptTz(d);
}

/** Store date-only values as UTC midnight for that calendar day. */
function utcDateOnly(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

function formatUrgency(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase() === "urgent" ? "urgent" : "standard";
}

function formatOrderSent(value: Date | null | undefined): string {
  if (!value) return "";
  return formatDate(value);
}

/** Build a full Rep.Parts26 row from a Neon rp_requests record. */
export function rpRequestToSheetRow(
  row: RpRow,
  photoUrl?: string | null,
): string[] {
  const values: string[] = [];
  values[RP_COLUMN.RP_NUM] = row.rpNum ?? "";
  values[RP_COLUMN.ENTRY_DATE] = formatDate(row.entryDate);
  values[RP_COLUMN.DUE_DATE] = formatDate(row.dueDate);
  values[RP_COLUMN.MARKET] = row.market ?? "";
  values[RP_COLUMN.USER_ID] = row.userId ?? "";
  values[RP_COLUMN.ISSUE_TYPE] = row.issueType ?? "";
  values[RP_COLUMN.URGENCY] = formatUrgency(row.urgency);
  values[RP_COLUMN.MODEL] = row.model ?? "";
  values[RP_COLUMN.BOOTH_ID] = row.boothId ?? "";
  values[RP_COLUMN.COLOR] = row.color ?? "";
  values[RP_COLUMN.ITEM_TYPE] = row.itemType ?? "";
  values[RP_COLUMN.QUANTITY] = row.quantity ?? "";
  values[RP_COLUMN.PART_RP_CODE] = row.partRpCode ?? "";
  values[RP_COLUMN.PART_DESCRIPTION] = row.partDescription ?? "";
  values[RP_COLUMN.CLARIFICATIONS] = row.clarifications ?? "";
  values[RP_COLUMN.NOTES] = row.notes ?? "";
  values[RP_COLUMN.CLIENT] = row.client ?? "";
  values[RP_COLUMN.ADDRESS] = row.address ?? "";
  values[RP_COLUMN.RECIPIENT] = row.recipient ?? "";
  values[RP_COLUMN.PHONE] = row.phone ?? "";
  values[RP_COLUMN.EMAIL] = row.email ?? "";
  values[RP_COLUMN.REVIEW_GROUP] = row.reviewGroup ?? "";
  values[RP_COLUMN.SHIP_METHOD] = row.shipMethod ?? "";
  values[RP_COLUMN.STATUS] = row.status ?? "";
  values[RP_COLUMN.TRACKING] = row.tracking ?? "";
  values[RP_COLUMN.READY_MARKED] = formatDate(row.readyMarkedAt);
  values[RP_COLUMN.PAYER] = row.payer ?? "";
  values[RP_COLUMN.CURRENT_LOCATION] = row.currentLocation ?? "";
  values[RP_COLUMN.WORKSHOP_NOTE] = resolveWorkshopNoteForSheetSync(row);
  values[RP_COLUMN.ORDER_SENT] = formatOrderSent(row.orderSentAt);
  values[RP_COLUMN.RP_PHOTO] = photoUrl ?? "";
  return padRow(values, RP_LAST_COLUMN);
}

/** Build a full Internal Production row from Neon. */
export function ipRowToSheetRow(row: IpRow): string[] {
  const values: string[] = [];
  values[IP_COLUMN.IP_NUM] = row.ipNum ?? "";
  values[IP_COLUMN.ENTRY_DATE] = formatDate(row.entryDate);
  values[IP_COLUMN.DEADLINE] = formatDate(row.deadline);
  values[IP_COLUMN.OWNER_EMAIL] = row.ownerEmail ?? "";
  values[IP_COLUMN.REASON] = row.reason ?? "";
  values[IP_COLUMN.URGENCY] = formatUrgency(row.urgency);
  values[IP_COLUMN.MODEL] = row.model ?? "";
  values[IP_COLUMN.BATCH] = row.batch ?? "";
  values[IP_COLUMN.COLOUR] = row.colour ?? "";
  values[IP_COLUMN.PANEL] = row.panel ?? "";
  values[IP_COLUMN.PANEL_CLARIFICATION] = row.panelClarification ?? "";
  values[IP_COLUMN.NOTES] = row.notes ?? "";
  values[IP_COLUMN.WAREHOUSE] = row.warehouse ?? "";
  values[IP_COLUMN.FACTORY] = row.factory ?? "";
  values[IP_COLUMN.STATUS] = row.status ?? "";
  values[IP_COLUMN.TRACKING] = row.tracking ?? "";
  values[IP_COLUMN.PAYER] = row.payer ?? "";
  values[IP_COLUMN.SOURCE_RP] = row.sourceRpNum ?? "";
  values[IP_COLUMN.WORKSHOP_NOTE] = row.workshopNote ?? "";
  values[IP_COLUMN.ORDER_SENT] = formatOrderSent(row.orderSentAt);
  return padRow(values, IP_LAST_COLUMN);
}

/**
 * Parse sheet date cells. Rep.Parts26 uses EU locale display (DD/MM/YYYY).
 * Do not use `new Date("12/1/2026")` — that is US MM/DD and turns 12 Jan into 1 Dec.
 */
function parseSheetDate(raw: string | number | null | undefined): Date | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Google Sheets serial (days since 1899-12-30)
    const epoch = Date.UTC(1899, 11, 30);
    const wholeDays = Math.floor(raw);
    const d = new Date(epoch + wholeDays * 86_400_000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const text = String(raw ?? "").trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    return utcDateOnly(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // DD/MM/YYYY or D/M/YYYY (sheet FORMATTED_VALUE in EU locale)
  const eu = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (eu) {
    return utcDateOnly(Number(eu[3]), Number(eu[2]), Number(eu[1]));
  }

  // Sheets sometimes returns a bare serial as a string
  if (/^\d+(\.\d+)?$/.test(text)) {
    return parseSheetDate(Number(text));
  }

  return null;
}

function parseUrgency(raw: string): "standard" | "urgent" {
  return raw.trim().toLowerCase() === "urgent" ? "urgent" : "standard";
}

/**
 * Order-sent column: blank = not sent; otherwise a date (EU or ISO).
 * Legacy text markers like "Изпратено" are ignored (treated as not sent) —
 * the sheet now uses dates only.
 */
function parseOrderSent(raw: string): Date | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  return parseSheetDate(text);
}

/** Parse a Rep.Parts26 sheet row (array from A onward) into insert/update payload. */
export function sheetRowToRpRequest(
  cells: (string | number | boolean | null | undefined)[],
  rowNumber: number,
) {
  const cell = (idx: number) => String(cells[idx] ?? "").trim();
  const rpNum = cell(RP_COLUMN.RP_NUM);
  if (!rpNum) return null;

  return {
    rpNum,
    rowNumber,
    data: {
      rpNum,
      entryDate: parseSheetDate(cell(RP_COLUMN.ENTRY_DATE)),
      dueDate: parseSheetDate(cell(RP_COLUMN.DUE_DATE)),
      market: cell(RP_COLUMN.MARKET) || null,
      userId: cell(RP_COLUMN.USER_ID) || null,
      issueType: cell(RP_COLUMN.ISSUE_TYPE) || null,
      urgency: parseUrgency(cell(RP_COLUMN.URGENCY)),
      model: cell(RP_COLUMN.MODEL) || null,
      boothId: cell(RP_COLUMN.BOOTH_ID) || null,
      color: cell(RP_COLUMN.COLOR) || null,
      itemType: cell(RP_COLUMN.ITEM_TYPE) || null,
      quantity: cell(RP_COLUMN.QUANTITY) || null,
      partRpCode: cell(RP_COLUMN.PART_RP_CODE) || null,
      partDescription: cell(RP_COLUMN.PART_DESCRIPTION) || null,
      clarifications: cell(RP_COLUMN.CLARIFICATIONS) || null,
      notes: cell(RP_COLUMN.NOTES) || null,
      client: cell(RP_COLUMN.CLIENT) || null,
      address: cell(RP_COLUMN.ADDRESS) || null,
      recipient: cell(RP_COLUMN.RECIPIENT) || null,
      phone: cell(RP_COLUMN.PHONE) || null,
      email: cell(RP_COLUMN.EMAIL) || null,
      reviewGroup: cell(RP_COLUMN.REVIEW_GROUP) || null,
      shipMethod: cell(RP_COLUMN.SHIP_METHOD) || null,
      status: cell(RP_COLUMN.STATUS) || null,
      tracking: cell(RP_COLUMN.TRACKING) || null,
      readyMarkedAt: parseSheetDate(cell(RP_COLUMN.READY_MARKED)),
      payer: cell(RP_COLUMN.PAYER) || null,
      currentLocation: cell(RP_COLUMN.CURRENT_LOCATION) || null,
      workshopNote: cell(RP_COLUMN.WORKSHOP_NOTE) || null,
      orderSentAt: parseOrderSent(cell(RP_COLUMN.ORDER_SENT)),
    },
  };
}

export function sheetRowToIpRow(
  cells: (string | number | boolean | null | undefined)[],
  rowNumber: number,
) {
  const cell = (idx: number) => String(cells[idx] ?? "").trim();
  const ipNum = cell(IP_COLUMN.IP_NUM);
  if (!ipNum) return null;

  return {
    ipNum,
    rowNumber,
    data: {
      ipNum,
      entryDate: parseSheetDate(cell(IP_COLUMN.ENTRY_DATE)),
      deadline: parseSheetDate(cell(IP_COLUMN.DEADLINE)),
      ownerEmail: cell(IP_COLUMN.OWNER_EMAIL) || null,
      reason: cell(IP_COLUMN.REASON) || null,
      urgency: parseUrgency(cell(IP_COLUMN.URGENCY)),
      model: cell(IP_COLUMN.MODEL) || null,
      batch: cell(IP_COLUMN.BATCH) || null,
      colour: cell(IP_COLUMN.COLOUR) || null,
      panel: cell(IP_COLUMN.PANEL) || null,
      panelClarification: cell(IP_COLUMN.PANEL_CLARIFICATION) || null,
      notes: cell(IP_COLUMN.NOTES) || null,
      warehouse: cell(IP_COLUMN.WAREHOUSE) || null,
      factory: cell(IP_COLUMN.FACTORY) || null,
      status: cell(IP_COLUMN.STATUS) || null,
      tracking: cell(IP_COLUMN.TRACKING) || null,
      payer: cell(IP_COLUMN.PAYER) || null,
      sourceRpNum: cell(IP_COLUMN.SOURCE_RP) || null,
      workshopNote: cell(IP_COLUMN.WORKSHOP_NOTE) || null,
      orderSentAt: parseOrderSent(cell(IP_COLUMN.ORDER_SENT)),
    },
  };
}
