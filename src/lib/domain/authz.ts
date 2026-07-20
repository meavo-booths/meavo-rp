/**
 * Role-based access (ported from GAS WebAppLogic.js).
 */

import { getAllowedRegionalScopes } from "@/lib/domain/standard-regional-scopes";

export type ReviewerDashboardConfig = {
  allowedReviewGroups: string[];
  allowedItemTypes?: string[];
  allowAllItemTypes?: boolean;
  excludedItemTypes?: string[];
  showSourceFilter?: boolean;
  mergeInternalProduction?: boolean;
  /** All active RP rows get a single "Информирай логистика" button (Nikolay). */
  logisticsButtonOnly?: boolean;
  /** Panel RP rows get the logistics-notify button; parts keep ship controls (Stefan). */
  panelLogisticsButtonOnly?: boolean;
  /** Hide recipient/address column (Nikolay production dashboard). */
  hideShippingAddressSection?: boolean;
};

const ADMIN_EMAILS = new Set(["boyan@meavo.com", "todor@meavo.com"]);

const LOGISTICS_VIEWER_EMAILS = new Set([
  "georgi.stoyanov@meavo.com",
  "nikola@meavo.com",
]);

const ACTIVE_URGENT_PANELS_EMAILS = new Set([
  "yavor@meavo.com",
  "kalin@meavo.com",
]);

const REVIEWER_DASHBOARD_CONFIGS: Record<string, ReviewerDashboardConfig> = {
  "anna@meavo.com": {
    allowedReviewGroups: ["AKS", "VAR"],
    allowedItemTypes: ["PART", "PARTS", "STOCK"],
  },
  "nikolay@meavo.com": {
    allowedReviewGroups: ["AKS"],
    allowAllItemTypes: true,
    excludedItemTypes: ["PART", "PARTS", "STOCK", "SPARE"],
    showSourceFilter: true,
    mergeInternalProduction: true,
    logisticsButtonOnly: true,
    hideShippingAddressSection: true,
  },
  "stefan@meavo.com": {
    allowedReviewGroups: ["KAZ"],
    allowAllItemTypes: true,
    mergeInternalProduction: true,
    panelLogisticsButtonOnly: true,
  },
};

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isAdminUser(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.has(normalizeEmail(email));
}

export function isLogisticsViewer(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  return isAdminUser(e) || LOGISTICS_VIEWER_EMAILS.has(e);
}

export function isActiveUrgentPanelsUser(
  email: string | null | undefined,
): boolean {
  return ACTIVE_URGENT_PANELS_EMAILS.has(normalizeEmail(email));
}

export function getReviewerDashboardConfig(
  email: string | null | undefined,
): ReviewerDashboardConfig | null {
  return REVIEWER_DASHBOARD_CONFIGS[normalizeEmail(email)] ?? null;
}

export function getRegionalScopes(email: string | null | undefined): string[] {
  return getAllowedRegionalScopes(email);
}

export function getEffectiveUserEmail(
  currentEmail: string,
  simulatedEmail: string | null | undefined,
  isAdmin: boolean,
): string {
  const simulated = normalizeEmail(simulatedEmail);
  if (isAdmin && simulated.endsWith("@meavo.com")) {
    return simulated;
  }
  return normalizeEmail(currentEmail);
}

export function assertAuthenticated(
  email: string | null | undefined,
): asserts email is string {
  if (!normalizeEmail(email)) {
    throw new Error("Authentication required");
  }
}

export function assertAdmin(email: string | null | undefined): void {
  assertAuthenticated(email);
  if (!isAdminUser(email)) {
    throw new Error("Admin access required");
  }
}

/** Port of GAS normalizeFactoryGroup_ — only KAZ/VAR carry workshop notes. */
export function normalizeWorkshopFactoryGroup(
  value: string | null | undefined,
): "KAZ" | "VAR" | "" {
  const upper = (value ?? "").trim().toUpperCase();
  if (upper === "KAZ" || upper === "VAR") return upper;
  return "";
}

/** Port of GAS isPanelLikeItemTypeForWorkshopNote_. */
export function isPanelLikeItemTypeForWorkshopNote(
  itemType: string | null | undefined,
): boolean {
  const upper = (itemType ?? "").trim().toUpperCase();
  return !["PART", "PARTS", "STOCK", "SPARE"].some((t) => upper.includes(t));
}

/** Port of GAS isWorkshopNoteViewerForFactory_ — KAZ: Stefan/Kalin; VAR: Boyan/Yavor/Ivan/Kalin. */
export function isWorkshopNoteViewerForFactory(
  viewerEmail: string | null | undefined,
  factoryGroup: string,
): boolean {
  const ev = normalizeEmail(viewerEmail);
  if (factoryGroup === "KAZ") {
    return ev === "stefan@meavo.com" || ev === "kalin@meavo.com";
  }
  if (factoryGroup === "VAR") {
    return (
      ev === "boyan@meavo.com" ||
      ev === "yavor@meavo.com" ||
      ev === "ivan@meavo.com" ||
      ev === "kalin@meavo.com"
    );
  }
  return false;
}

/** Combined check: factory group present + panel-like item + allowed viewer. */
export function canEditWorkshopNote(
  viewerEmail: string | null | undefined,
  factoryValue: string | null | undefined,
  itemType: string | null | undefined,
): boolean {
  const group = normalizeWorkshopFactoryGroup(factoryValue);
  if (!group) return false;
  if (!isPanelLikeItemTypeForWorkshopNote(itemType)) return false;
  return isWorkshopNoteViewerForFactory(viewerEmail, group);
}

const DUE_DATE_EDITORS = new Set([
  "anna@meavo.com",
  "stefan@meavo.com",
  "nikolay@meavo.com",
]);

export function canEditDueDate(
  email: string | null | undefined,
): boolean {
  const e = normalizeEmail(email);
  if (isAdminUser(e)) return true;
  return DUE_DATE_EDITORS.has(e);
}

const WORKSHOP_NOTE_DASHBOARD_VIEWERS = new Set([
  "stefan@meavo.com",
  "ivan@meavo.com",
  "kalin@meavo.com",
  "yavor@meavo.com",
]);

/** Due date pinned to the left column (GAS isWorkshopNoteDashboardViewer_). */
export function isWorkshopNoteDashboardViewer(
  email: string | null | undefined,
): boolean {
  const e = normalizeEmail(email);
  if (isAdminUser(e)) return true;
  return WORKSHOP_NOTE_DASHBOARD_VIEWERS.has(e);
}

const IP_LOGGER_EMAILS = new Set([
  "nikolay@meavo.com",
  "kalin@meavo.com",
]);

export function canLogIp(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  return isAdminUser(e) || IP_LOGGER_EMAILS.has(e);
}

/** Anna / logistics / admin — mark parts shipped or edit ship info from dashboard. */
export function canShipRpParts(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  if (isAdminUser(e)) return true;
  if (e === "anna@meavo.com") return true;
  return isLogisticsViewer(e);
}

/** Anna-only ready workflow (UI shows only for Anna). */
export function canAnnaMarkReady(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  return isAdminUser(e) || e === "anna@meavo.com";
}

/**
 * GAS normalizeSimulationEmail_: bare local-part → @meavo.com.
 * Returns "" for empty input; otherwise a lowercased address.
 */
export function normalizeSimulationEmail(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (!raw.includes("@")) return `${raw}@meavo.com`;
  return raw;
}

export function isMeavoSimulationEmail(email: string): boolean {
  return /^[a-z0-9._+-]+@meavo\.com$/.test(email);
}
