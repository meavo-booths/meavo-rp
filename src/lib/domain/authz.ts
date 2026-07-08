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
};

const ADMIN_EMAILS = new Set(["boyan@meavo.com", "todor@meavo.com"]);

const LOGISTICS_VIEWER_EMAILS = new Set([
  "anna@meavo.com",
  "todor@meavo.com",
]);

const ACTIVE_URGENT_PANELS_EMAILS = new Set([
  "boyan@meavo.com",
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
  },
  "stefan@meavo.com": {
    allowedReviewGroups: ["KAZ"],
    allowAllItemTypes: true,
    mergeInternalProduction: true,
  },
};

const STANDARD_REGIONAL_SCOPES: Record<string, string[]> = {
  "dimitar@meavo.com": ["BG", "RO"],
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
