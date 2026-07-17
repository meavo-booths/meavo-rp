/**
 * UI locale strings — GAS parity (getLabels_ in index.html).
 * English: standard field staff, admin “own RPs”, logistics, AUP.
 * Bulgarian: factory/warehouse reviewers (Anna, Nikolay, Stefan, Ivan, Todor).
 */

import type { ViewerRole } from "@/lib/viewer-context";

export type UiLocale = "en" | "bg";

export type DashboardUiLabels = {
  locale: UiLocale;
  myRpsTitle: string;
  dashboardTitle: string;
  viewingAs: string;
  newRp: string;
  logRp: string;
  logIp: string;
  tabActive: string;
  tabReady: string;
  tabArchive: string;
  tabCancelled: string;
  searchPlaceholder: string;
  emptyView: string;
  sortLabel: string;
  sortNewest: string;
  sortOldest: string;
  clearFilters: string;
  marketLabel: string;
  marketAll: string;
  factoryLabel: string;
  factoryAll: string;
  sourceLabel: string;
  sourceAll: string;
  sourceRp: string;
  sourceIp: string;
  itemLabel: string;
  itemAll: string;
  itemParts: string;
  itemPanels: string;
  updating: string;
};

const EN: DashboardUiLabels = {
  locale: "en",
  myRpsTitle: "My RPs",
  dashboardTitle: "Dashboard",
  viewingAs: "Viewing as",
  newRp: "New RP",
  logRp: "Log RP",
  logIp: "Log IP",
  tabActive: "Active",
  tabReady: "Ready",
  tabArchive: "Shipped",
  tabCancelled: "Cancelled",
  searchPlaceholder: "Search RP, client, market…",
  emptyView: "No records in this view.",
  sortLabel: "Sort",
  sortNewest: "Newest",
  sortOldest: "Oldest",
  clearFilters: "Clear filters",
  marketLabel: "Market",
  marketAll: "All markets",
  factoryLabel: "Factory",
  factoryAll: "All",
  sourceLabel: "Source",
  sourceAll: "All",
  sourceRp: "Spare parts",
  sourceIp: "Internal production",
  itemLabel: "Type",
  itemAll: "All",
  itemParts: "Parts",
  itemPanels: "Panels",
  updating: "Updating…",
};

const BG: DashboardUiLabels = {
  locale: "bg",
  myRpsTitle: "Моите RP",
  dashboardTitle: "Табло",
  viewingAs: "Преглед като",
  newRp: "Нов RP",
  logRp: "Нов RP",
  logIp: "Нов IP",
  tabActive: "Активни",
  tabReady: "Готови",
  tabArchive: "Изпратени",
  tabCancelled: "Отказани",
  searchPlaceholder: "Търсене RP, клиент, пазар…",
  emptyView: "Няма записи в този изглед.",
  sortLabel: "Подредба",
  sortNewest: "Най-нови",
  sortOldest: "Най-стари",
  clearFilters: "Изчисти филтри",
  marketLabel: "Пазар",
  marketAll: "Всички пазари",
  factoryLabel: "Фабрика",
  factoryAll: "Всички",
  sourceLabel: "Източник",
  sourceAll: "Всички",
  sourceRp: "Резервни части",
  sourceIp: "Вътрешна продукция",
  itemLabel: "Тип",
  itemAll: "Всички",
  itemParts: "Части",
  itemPanels: "Панели",
  updating: "Обновяване…",
};

/** Roles that use Bulgarian UI (factory / warehouse dashboards). */
const BG_ROLES = new Set<ViewerRole>([
  "reviewer",
  "nikolay",
  "stefan",
  "ivan",
  "todor",
]);

export function getUiLocaleForRole(
  role: ViewerRole,
  options?: { ownLoggedParts?: boolean },
): UiLocale {
  // Admin / Kalin / Yavor “own logged parts” is English in GAS.
  if (options?.ownLoggedParts) return "en";
  return BG_ROLES.has(role) ? "bg" : "en";
}

export function getDashboardUiLabels(
  role: ViewerRole,
  options?: { ownLoggedParts?: boolean },
): DashboardUiLabels {
  return getUiLocaleForRole(role, options) === "bg" ? BG : EN;
}

export function ownRpsTitleForEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (e === "kalin@meavo.com") return "Kalin's RPs";
  if (e === "yavor@meavo.com") return "Yavor's RPs";
  if (e === "boyan@meavo.com") return "Boyan's RPs";
  if (e === "todor@meavo.com" || e === "todor.dimitrov@meavo.com") {
    return "Todor's RPs";
  }
  return "My RPs";
}
