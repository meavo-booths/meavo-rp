/**
 * Parse Rep.Parts26 columns K–O into normalized line items.
 * Ports buildItemsForWeb_ / splitPipeValue_ from legacy GAS.
 */

import type { RpRequest } from "@prisma/client";

type RpRow = RpRequest;

export type ParsedRpLineItem = {
  lineIndex: number;
  kind: "panel" | "part";
  panelName: string | null;
  quantity: string | null;
  partRpCode: string | null;
  partDescription: string | null;
  clarifications: string | null;
};

const PART_ITEM_TYPES = new Set([
  "PART",
  "PARTS",
  "STOCK",
  "SPARE",
  "OTHER PARTS",
]);

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function cleanIndexedValue(value: string): string {
  if (!value) return "";
  return value.replace(/^\d+\)\s*/, "").trim();
}

function splitMultiValue(value: string): string[] {
  const normalized = normalizeCell(value);
  if (!normalized) return [];
  const parts =
    normalized.includes("\n")
      ? normalized.split(/\r?\n/)
      : normalized.split("|");
  return parts
    .map((part) => cleanIndexedValue(part))
    .filter((part) => part !== "");
}

function isPartsSpecifyHintText(text: string): boolean {
  return /^PARTS\s*\(\s*specify\b/i.test(normalizeCell(text));
}

function isPartItemType(itemType: string): boolean {
  return PART_ITEM_TYPES.has(itemType.trim().toUpperCase());
}

function classifyKind(itemType: string, code: string): "panel" | "part" {
  if (isPartItemType(itemType) || code) return "part";
  return "panel";
}

/** Build line items from a flat rp_requests row (sheet-style columns). */
export function parseRpLineItemsFromRow(row: RpRow): ParsedRpLineItem[] {
  const quantities = splitMultiValue(row.quantity ?? "");
  const codes = splitMultiValue(row.partRpCode ?? "");
  const descriptions = splitMultiValue(row.partDescription ?? "");
  const clarifications = splitMultiValue(row.clarifications ?? "");
  const itemTypes = splitMultiValue(row.itemType ?? "");
  const fallbackItemType = normalizeCell(row.itemType);

  const maxLength = Math.max(
    quantities.length,
    codes.length,
    descriptions.length,
    clarifications.length,
    itemTypes.length,
    1,
  );

  const items: ParsedRpLineItem[] = [];

  for (let i = 0; i < maxLength; i++) {
    const qty = quantities[i] ?? "";
    const code = codes[i] ?? "";
    const description = descriptions[i] ?? "";
    const clarification = clarifications[i] ?? "";
    const itemType = itemTypes[i] || fallbackItemType || "";

    if (!qty && !code && !description && !itemType) continue;

    const displayText =
      !qty && !code && !description && itemType ? itemType : description || itemType;
    if (isPartsSpecifyHintText(displayText)) continue;

    const kind = classifyKind(itemType, code);
    const panelName =
      kind === "panel"
        ? description || itemType || null
        : description || null;

    items.push({
      lineIndex: items.length,
      kind,
      panelName,
      quantity: qty || null,
      partRpCode: code || null,
      partDescription: description || null,
      clarifications: clarification || null,
    });
  }

  if (!items.length) {
    const kind = classifyKind(fallbackItemType, normalizeCell(row.partRpCode));
    items.push({
      lineIndex: 0,
      kind,
      panelName:
        kind === "panel"
          ? normalizeCell(row.partDescription) ||
            fallbackItemType ||
            null
          : normalizeCell(row.partDescription) || null,
      quantity: normalizeCell(row.quantity) || null,
      partRpCode: normalizeCell(row.partRpCode) || null,
      partDescription: normalizeCell(row.partDescription) || null,
      clarifications: normalizeCell(row.clarifications) || null,
    });
  }

  const hasNonHint = items.some(
    (item) =>
      !isPartsSpecifyHintText(item.panelName ?? "") &&
      !isPartsSpecifyHintText(item.partDescription ?? ""),
  );

  if (!hasNonHint) return items;

  return items.filter(
    (item) =>
      !isPartsSpecifyHintText(item.panelName ?? "") &&
      !isPartsSpecifyHintText(item.partDescription ?? ""),
  );
}

export function isPanelLineItem(item: { kind: string }): boolean {
  return item.kind === "panel";
}
