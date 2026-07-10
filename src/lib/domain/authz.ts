/**
 * Role-based access (ported from GAS WebAppLogic.js).
 */

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
  },
  "stefan@meavo.com": {
    allowedReviewGroups: ["KAZ"],
    allowAllItemTypes: true,
    mergeInternalProduction: true,
    panelLogisticsButtonOnly: true,
  },
};

const STANDARD_REGIONAL_SCOPES: Record<string, string[]> = {
  "vojtech@meavo.com": ["all_markets"],
  "hedi@meavo.com": ["fr_ch", "usa", "iberia", "de_balkans", "czechia"],
  "carla@meavo.com": ["uk"],
  "eftychia@meavo.com": ["uk"],
  "dimitar@meavo.com": ["de_balkans", "france"],
  "rosalia@meavo.com": ["usa"],
  "giulia@meavo.com": ["iberia"],
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
  return STANDARD_REGIONAL_SCOPES[normalizeEmail(email)] ?? [];
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
