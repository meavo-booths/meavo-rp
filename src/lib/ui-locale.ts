/**
 * UI locale strings — GAS parity (`getLabels_` / `getViewerRole_` in legacy-gas/index.html).
 *
 * ## Which accounts get which language
 *
 * | Locale | Accounts / roles |
 * |--------|------------------|
 * | **English** | Regional field staff (`carla@`, `hedi@`, `vojtech@`, …), `admin` (incl. own-parts view), `logistics` (Georgi, Nikola), `urgent_panels` (Kalin/Yavor AUP), admin simulating any EN persona |
 * | **Bulgarian** | Factory/warehouse: `anna@` (`reviewer`), `nikolay@`, `stefan@`, `ivan@`, `todor@` |
 *
 * GAS maps Nikolay/Stefan reviewer configs to the `"anna"` label set (BG). The webapp uses
 * the same strings via `nikolay` / `stefan` / `reviewer` roles.
 */

import type { ViewerContext, ViewerRole } from "@/lib/viewer-context";

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
  /** RP card + row actions (GAS getLabels_ card strings). */
  cardUrgentTag: string;
  cardIpTag: string;
  cardIpTagLong: string;
  cardEdit: string;
  cardCreateSimilar: string;
  cardCancel: string;
  cardNotifyLogistics: string;
  cardIpReady: string;
  cardReadyForLogistics: string;
  cardRevertReady: string;
  cardBringBack: string;
  cardClient: string;
  cardDueDate: string;
  cardProductionDeadline: string;
  cardModelBatch: string;
  cardDescription: string;
  cardShipping: string;
  cardWorkshopNote: string;
  cardPayer: string;
  cardChangeDueDate: string;
  cardMarkShipped: string;
  cardSaveShipping: string;
  cardBooth: string;
  cardModel: string;
  cardColor: string;
  cardItems: string;
  cardRecipient: string;
  cardMarket: string;
  cardAddress: string;
  cardPhone: string;
  cardEmail: string;
  cardClarification: string;
  cardNotes: string;
  cardTracking: string;
  promptWorkshopNote: string;
  promptPayer: string;
  promptNewDueDate: string;
  promptDueDateReason: string;
  promptShipMethod: string;
  promptTracking: string;
  /** Detail modal + click-to-open affordance. */
  openDetailTitle: string;
  detailClose: string;
  detailLoading: string;
  detailSubtitleRp: string;
  detailSubtitleIp: string;
  detailHistory: string;
  detailHistoryEmpty: string;
  detailInferred: string;
  detailFrom: string;
  detailLines: string;
  detailPhotos: string;
  detailLineFallback: string;
  detailStockTaken: string;
  detailStatus: string;
  detailUrgency: string;
  detailLogged: string;
  detailOwner: string;
  detailIssueType: string;
  detailBatch: string;
  detailPanel: string;
  detailItem: string;
  detailQuantity: string;
  detailCode: string;
  detailWarehouse: string;
  detailSourceRp: string;
  detailOrderSent: string;
  detailReadyAt: string;
  detailEventCreated: string;
  detailEventStatusChanged: string;
  detailEventReadyMarked: string;
  detailEventReadyReverted: string;
  detailEventOrderSent: string;
  detailEventShipped: string;
  detailEventCancelled: string;
  detailEventDelayed: string;
  detailEventStockTaken: string;
  detailEventEdited: string;
  detailEventWorkshopNote: string;
  detailEventDueDateChanged: string;
  detailEventShipInfoChanged: string;
  detailEventDelivered: string;
  detailEventPayerChanged: string;
  detailEventPhoto: string;
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
  cardUrgentTag: "URGENT",
  cardIpTag: "IP",
  cardIpTagLong: "Internal production",
  cardEdit: "Edit",
  cardCreateSimilar: "Create New",
  cardCancel: "Cancel",
  cardNotifyLogistics: "Notify logistics",
  cardIpReady: "Ready for warehouse",
  cardReadyForLogistics: "Ready for logistics",
  cardRevertReady: "Return to Active",
  cardBringBack: "Bring Back to Active",
  cardClient: "Client",
  cardDueDate: "Due date",
  cardProductionDeadline: "Production Deadline",
  cardModelBatch: "Model / Booth",
  cardDescription: "Description",
  cardShipping: "Shipping",
  cardWorkshopNote: "Бележка Цех",
  cardPayer: "Платец",
  cardChangeDueDate: "Change",
  cardMarkShipped: "Mark Shipped",
  cardSaveShipping: "Save",
  cardBooth: "Booth",
  cardModel: "Model",
  cardColor: "Color",
  cardItems: "Items",
  cardRecipient: "Recipient",
  cardMarket: "Market",
  cardAddress: "Address",
  cardPhone: "Phone",
  cardEmail: "Email",
  cardClarification: "Clarification",
  cardNotes: "Notes",
  cardTracking: "Tracking",
  promptWorkshopNote: "Workshop note",
  promptPayer: "Payer (leave blank to restore auto)",
  promptNewDueDate: "New due date (YYYY-MM-DD)",
  promptDueDateReason: "Reason for change",
  promptShipMethod: "Ship method",
  promptTracking: "Tracking",
  openDetailTitle: "Open details and history",
  detailClose: "Close",
  detailLoading: "Loading…",
  detailSubtitleRp: "Replacement Part — details & history",
  detailSubtitleIp: "Internal Production — details & history",
  detailHistory: "History",
  detailHistoryEmpty: "No history recorded.",
  detailInferred: "approximate",
  detailFrom: "from",
  detailLines: "Line items",
  detailPhotos: "Photos",
  detailLineFallback: "Line {n}",
  detailStockTaken: "Stock",
  detailStatus: "Status",
  detailUrgency: "Urgency",
  detailLogged: "Logged",
  detailOwner: "Owner",
  detailIssueType: "Issue type",
  detailBatch: "Batch",
  detailPanel: "Panel",
  detailItem: "Item",
  detailQuantity: "Quantity",
  detailCode: "Code",
  detailWarehouse: "Warehouse",
  detailSourceRp: "Source RP",
  detailOrderSent: "Order sent",
  detailReadyAt: "Ready",
  detailEventCreated: "Logged",
  detailEventStatusChanged: "Status changed",
  detailEventReadyMarked: "Marked Ready",
  detailEventReadyReverted: "Reverted from Ready",
  detailEventOrderSent: "Order sent to factory",
  detailEventShipped: "Shipped",
  detailEventCancelled: "Cancelled",
  detailEventDelayed: "Delayed",
  detailEventStockTaken: "Taken from stock",
  detailEventEdited: "Edited",
  detailEventWorkshopNote: "Workshop note",
  detailEventDueDateChanged: "Due date changed",
  detailEventShipInfoChanged: "Shipping info updated",
  detailEventDelivered: "Delivered",
  detailEventPayerChanged: "Payer changed",
  detailEventPhoto: "Photo uploaded",
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
  cardUrgentTag: "Спешно",
  cardIpTag: "ВП",
  cardIpTagLong: "Вътрешна продукция",
  cardEdit: "Редакция",
  cardCreateSimilar: "Подобен RP",
  cardCancel: "Отказ",
  cardNotifyLogistics: "Информирай логистика",
  cardIpReady: "Готово за склад",
  cardReadyForLogistics: "Готов за логистика",
  cardRevertReady: "Върни в активни",
  cardBringBack: "Върни активен",
  cardClient: "Клиент",
  cardDueDate: "Срок",
  cardProductionDeadline: "Производствен срок",
  cardModelBatch: "Модел / Партида",
  cardDescription: "Описание",
  cardShipping: "Доставка",
  cardWorkshopNote: "Бележка цех",
  cardPayer: "Платец",
  cardChangeDueDate: "Промени",
  cardMarkShipped: "Маркирай изпратен",
  cardSaveShipping: "Запази доставка",
  cardBooth: "Booth",
  cardModel: "Модел",
  cardColor: "Цвят",
  cardItems: "Артикули",
  cardRecipient: "Получател",
  cardMarket: "Пазар",
  cardAddress: "Адрес",
  cardPhone: "Тел",
  cardEmail: "Email",
  cardClarification: "Уточнение",
  cardNotes: "Бележки",
  cardTracking: "Тракинг",
  promptWorkshopNote: "Бележка цех",
  promptPayer: "Платец (празно = автоматично)",
  promptNewDueDate: "Нов срок (YYYY-MM-DD)",
  promptDueDateReason: "Причина за промяна",
  promptShipMethod: "Метод на изпращане",
  promptTracking: "Тракинг номер",
  openDetailTitle: "Отвори детайли и история",
  detailClose: "Затвори",
  detailLoading: "Зареждане…",
  detailSubtitleRp: "Replacement Part — детайли и история",
  detailSubtitleIp: "Internal Production — детайли и история",
  detailHistory: "История",
  detailHistoryEmpty: "Няма записана история.",
  detailInferred: "приблизително",
  detailFrom: "от",
  detailLines: "Редове",
  detailPhotos: "Снимки",
  detailLineFallback: "Ред {n}",
  detailStockTaken: "Склад",
  detailStatus: "Статус",
  detailUrgency: "Спешност",
  detailLogged: "Логнат",
  detailOwner: "Собственик",
  detailIssueType: "Тип",
  detailBatch: "Партида",
  detailPanel: "Панел",
  detailItem: "Артикул",
  detailQuantity: "Количество",
  detailCode: "Код",
  detailWarehouse: "Склад",
  detailSourceRp: "Източник RP",
  detailOrderSent: "Поръчка изпратена",
  detailReadyAt: "Ready",
  detailEventCreated: "Логнат",
  detailEventStatusChanged: "Смяна на статус",
  detailEventReadyMarked: "Маркиран Ready",
  detailEventReadyReverted: "Върнат от Ready",
  detailEventOrderSent: "Поръчка изпратена към завод",
  detailEventShipped: "Изпратен",
  detailEventCancelled: "Отказан",
  detailEventDelayed: "Отложен",
  detailEventStockTaken: "Взет от склад",
  detailEventEdited: "Редактиран",
  detailEventWorkshopNote: "Бележка работилница",
  detailEventDueDateChanged: "Сменен срок",
  detailEventShipInfoChanged: "Данни за доставка",
  detailEventDelivered: "Доставен",
  detailEventPayerChanged: "Сменен платец",
  detailEventPhoto: "Качена снимка",
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

export function getDashboardUiLabelsForViewer(
  viewer: ViewerContext,
  options?: { ownLoggedParts?: boolean },
): DashboardUiLabels {
  return getDashboardUiLabels(viewer.role, options);
}

/** Localized timeline / lifecycle event title for the detail modal. */
export function detailEventLabel(
  labels: DashboardUiLabels,
  eventType: string,
): string {
  switch (eventType) {
    case "created":
      return labels.detailEventCreated;
    case "status_changed":
      return labels.detailEventStatusChanged;
    case "ready_marked":
      return labels.detailEventReadyMarked;
    case "ready_reverted":
      return labels.detailEventReadyReverted;
    case "order_sent":
      return labels.detailEventOrderSent;
    case "shipped":
      return labels.detailEventShipped;
    case "cancelled":
      return labels.detailEventCancelled;
    case "delayed":
      return labels.detailEventDelayed;
    case "stock_taken":
      return labels.detailEventStockTaken;
    case "edited":
      return labels.detailEventEdited;
    case "workshop_note":
      return labels.detailEventWorkshopNote;
    case "due_date_changed":
      return labels.detailEventDueDateChanged;
    case "ship_info_changed":
      return labels.detailEventShipInfoChanged;
    case "delivered":
      return labels.detailEventDelivered;
    case "payer_changed":
      return labels.detailEventPayerChanged;
    case "photo":
      return labels.detailEventPhoto;
    default:
      return eventType;
  }
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
