import { cookies } from "next/headers";

import {
  getEffectiveUserEmail,
  getRegionalScopes,
  getReviewerDashboardConfig,
  isAdminUser,
  isActiveUrgentPanelsUser,
  isLogisticsViewer,
  normalizeEmail,
  type ReviewerDashboardConfig,
} from "@/lib/domain/authz";

export type ViewerRole =
  | "admin"
  | "standard"
  | "reviewer"
  | "logistics"
  | "urgent_panels"
  | "nikolay"
  | "stefan"
  | "ivan"
  | "todor";

export type ViewerContext = {
  sessionEmail: string;
  effectiveEmail: string;
  isAdmin: boolean;
  isSimulating: boolean;
  role: ViewerRole;
  reviewerConfig: ReviewerDashboardConfig | null;
  regionalScopes: string[];
  defaultDashboardPath: string;
};

const SIMULATE_COOKIE = "rp_simulate_email";

const TODOR_EMAIL = "todor.dimitrov@meavo.com";
const IVAN_EMAIL = "ivan@meavo.com";
const NIKOLAY_EMAIL = "nikolay@meavo.com";
const STEFAN_EMAIL = "stefan@meavo.com";
const KALIN_EMAIL = "kalin@meavo.com";
const YAVOR_EMAIL = "yavor@meavo.com";

export async function getSimulatedEmail(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(SIMULATE_COOKIE)?.value?.trim().toLowerCase();
  return value || null;
}

export function resolveViewerRole(email: string): ViewerRole {
  const e = normalizeEmail(email);
  if (isAdminUser(e) && e !== TODOR_EMAIL) return "admin";
  if (e === TODOR_EMAIL) return "todor";
  if (e === IVAN_EMAIL) return "ivan";
  if (e === NIKOLAY_EMAIL) return "nikolay";
  if (e === STEFAN_EMAIL) return "stefan";
  if (isLogisticsViewer(e)) return "logistics";
  if (isActiveUrgentPanelsUser(e) && (e === YAVOR_EMAIL || e === KALIN_EMAIL)) {
    return "urgent_panels";
  }
  if (getReviewerDashboardConfig(e)) return "reviewer";
  return "standard";
}

function defaultPathForRole(role: ViewerRole): string {
  switch (role) {
    case "nikolay":
      return "/dashboard/nikolay";
    case "stefan":
      return "/dashboard/stefan";
    case "logistics":
      return "/dashboard/logistics";
    case "urgent_panels":
      return "/dashboard/urgent-panels";
    case "ivan":
      return "/dashboard/ivan";
    case "todor":
      return "/dashboard/todor";
    case "reviewer":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

export async function resolveViewerContext(
  sessionEmail: string,
): Promise<ViewerContext> {
  const simulated = await getSimulatedEmail();
  const isAdmin = isAdminUser(sessionEmail);
  const effectiveEmail = getEffectiveUserEmail(
    sessionEmail,
    simulated,
    isAdmin,
  );
  const role = resolveViewerRole(effectiveEmail);
  return {
    sessionEmail: normalizeEmail(sessionEmail),
    effectiveEmail,
    isAdmin,
    isSimulating: Boolean(simulated && isAdmin),
    role,
    reviewerConfig: getReviewerDashboardConfig(effectiveEmail),
    regionalScopes: getRegionalScopes(effectiveEmail),
    defaultDashboardPath: defaultPathForRole(role),
  };
}

export { SIMULATE_COOKIE };
