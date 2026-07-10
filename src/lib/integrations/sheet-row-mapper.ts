import type { RpInternalProductionRow, RpRequest } from "@prisma/client";
import { resolveWorkshopNoteForSheetSync } from "@/lib/domain/rp-header-stock";
import {
  IP_COLUMN,
  IP_LAST_COLUMN,
  RP_COLUMN,
  RP_LAST_COLUMN,
} from "@/lib/integrations/rp-sheet-columns";

type RpRow = RpRequest;
type IpRow = RpInternalProductionRow;

function padRow(values: string[], lastCol: number): string[] {
  const row = new Array<string>(lastCol + 1).fill("");
  for (let i = 0; i < values.length && i <= lastCol; i++) {
    row[i] = values[i] ?? "";
  }
  return row;
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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

function parseSheetDate(raw: string): Date | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseUrgency(raw: string): "standard" | "urgent" {
  return raw.trim().toLowerCase() === "urgent" ? "urgent" : "standard";
}

function parseOrderSent(raw: string): Date | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  return parseSheetDate(text) ?? new Date();
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
