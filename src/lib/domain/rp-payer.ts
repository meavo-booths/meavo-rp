/**
 * RP Платец (payer) — based on the Rep.Parts26 ARRAYFORMULA on column AA,
 * with panel detection improved for multi-line orders: any panel line counts,
 * regardless of position.
 *
 * Inputs:
 * - issueType (F)
 * - reviewGroup / factory (V)
 * - line items / itemType (K) — panel-like if any line is a panel
 */

import {
  isPanelLineItem,
  parseRpLineItemsFromRow,
  type RpRowForLineItems,
} from "@/lib/domain/rp-line-items";

export type RpPayerInputs = {
  issueType: string | null | undefined;
  reviewGroup: string | null | undefined;
  itemType: string | null | undefined;
  quantity?: string | null | undefined;
  partRpCode?: string | null | undefined;
  partDescription?: string | null | undefined;
  clarifications?: string | null | undefined;
  /** Prefer when already known (logger items / RpLineItem). */
  lineItems?: Array<{ kind: string }>;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function splitItemTypeSegments(itemType: string | null | undefined): string[] {
  const normalized = norm(itemType);
  if (!normalized) return [];
  const parts = normalized.includes("\n")
    ? normalized.split(/\r?\n/)
    : normalized.split("|");
  return parts
    .map((part) => part.replace(/^\d+\)\s*/, "").trim())
    .filter(Boolean);
}

/** Sheet-style panel token: ends with "(X)" for a single A–Z letter. */
export function isPanelLikeItemTypeSegment(
  segment: string | null | undefined,
): boolean {
  return /\([A-Z]\)$/.test(norm(segment));
}

/**
 * True when the RP contains at least one panel line — position does not matter.
 * Prefers explicit lineItems, then parsed header columns, then any K segment
 * matching the sheet `(X)` token.
 */
export function isPanelLikeForPayer(input: RpPayerInputs): boolean {
  if (input.lineItems?.some((item) => item.kind === "panel")) return true;

  const row: RpRowForLineItems = {
    itemType: input.itemType ?? null,
    quantity: input.quantity ?? null,
    partRpCode: input.partRpCode ?? null,
    partDescription: input.partDescription ?? null,
    clarifications: input.clarifications ?? null,
  };
  const parsed = parseRpLineItemsFromRow(row);
  if (parsed.some(isPanelLineItem)) return true;

  return splitItemTypeSegments(input.itemType).some(isPanelLikeItemTypeSegment);
}

/**
 * Compute Платец from current RP fields (ignores historic sheet AA).
 * Returns "" when issue type is blank (same as the sheet formula).
 */
export function computeRpPayer(input: RpPayerInputs): string {
  const issue = norm(input.issueType);
  if (!issue) return "";

  const factory = norm(input.reviewGroup);
  if (!factory) return "Enter Factory";

  if (factory.toUpperCase() === "AKS") return "OA";

  const panelLike = isPanelLikeForPayer(input);

  if (issue === "Faulty Unit") {
    return panelLike ? factory : "OA";
  }

  if (issue === "Factory Mistake") {
    return panelLike ? factory : "OA?";
  }

  return "OA";
}

/** Prisma-ready value: blank formula result → null. */
export function computeRpPayerForDb(input: RpPayerInputs): string | null {
  const value = computeRpPayer(input);
  return value ? value : null;
}

/**
 * Next payer write for auto mode. Returns null when payerManual is set or
 * the stored value already matches the formula.
 */
export function autoPayerUpdate(
  row: RpPayerInputs & {
    payer: string | null | undefined;
    payerManual: boolean;
  },
): { payer: string | null } | null {
  if (row.payerManual) return null;
  const next = computeRpPayerForDb(row);
  if (norm(row.payer) === norm(next)) return null;
  return { payer: next };
}
