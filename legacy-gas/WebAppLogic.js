/** MANAGER DASHBOARD LOGIC */

var CONFIG = {
  TARGET_SHEET: "Rep.Parts26",
  INTERNAL_PRODUCTION_SHEET: "Internal Production"
};

/** Internal Production sheet columns (through T). */
var INTERNAL_PRODUCTION_COL = {
  IP_NUM: 1,
  DATE: 2,
  DEADLINE: 3,
  OWNER: 4,
  REASON: 5,
  URGENCY: 6,
  MODEL: 7,
  BATCH: 8,
  COLOUR: 9,
  PANEL: 10,
  PANEL_CLARIFICATION: 11,
  NOTES: 12,
  WAREHOUSE: 13,
  FACTORY: 14,
  STATUS: 16,
  TRACKING: 17,
  PAYER: 18,
  SOURCE_RP: 19,
  WORKSHOP_NOTE: 20,    // T — Бележка Цех
  ORDER_SENT: 21        // U — Изпратена Поръчка
};
var INTERNAL_PRODUCTION_LAST_COL_ = INTERNAL_PRODUCTION_COL.ORDER_SENT;
/** Written on Rep.Parts26 AD when an IP row is tied to that RP (avoid duplicate production). */
var RP_DO_NOT_PRODUCE_WORKSHOP_NOTE_ = "Не произвеждай!";
var REVIEWER_DASHBOARD_CONFIGS_ = {
  "anna@meavo.com": {
    allowedReviewGroups: ["AKS", "VAR"],
    allowedItemTypes: ["PART", "PARTS", "STOCK"]
  },
  "nikolay@meavo.com": {
    allowedReviewGroups: ["AKS"],
    allowAllItemTypes: true,
    excludedItemTypes: ["PART", "PARTS", "STOCK", "SPARE"],
    defaultShipMethod: "Pallet"
  },
  "stefan@meavo.com": {
    allowedReviewGroups: ["KAZ"],
    allowAllItemTypes: true
  }
};
/** Emails that see the Active Urgent Panels dashboard (keep in sync with index.html isActiveUrgentPanelsMode_). */
var ACTIVE_URGENT_PANELS_EMAILS_ = {
  "yavor@meavo.com": true,
  "kalin@meavo.com": true
};
/** Logistics dashboard (replacement parts): keep in sync with index.html isLogisticsViewer_. */
var LOGISTICS_VIEWER_EMAILS_ = {
  "georgi.stoyanov@meavo.com": true,
  "nikola@meavo.com": true
};
/** Todor Dimitrov shipping / Topoli warehouse dashboard — keep in sync with index.html isTodorDashboardMode_. */
var TODOR_DASHBOARD_VIEWER_EMAILS_ = {
  "todor.dimitrov@meavo.com": true
};
/** Ivan dashboard (read-only all RP types) — keep in sync with index.html isIvanDashboardMode_. */
var IVAN_DASHBOARD_VIEWER_EMAILS_ = {
  "ivan@meavo.com": true
};
var TODOR_SHIPPING_FACTORY_CODES_ = {
  VS: true,
  AS: true
};
var SHIPPING_WEEK_FACTORY_NAMES_ = {
  VS: "VAR",
  AS: "AKS",
  KS: "KAZ"
};
var TOPOLI_WAREHOUSE_LOCATION_ = "topoli warehouse";
var RP_EDIT_WINDOW_MS_ = 2 * 60 * 60 * 1000;
var RP_EDIT_WINDOW_EXPIRED_MSG_ = "Time window for editting has passed. If you want to edit the RP, please cancel it and create a new one.";

/**
 * Standard-user regional expansion: email -> allowed scope tokens (client sends pipe-separated, e.g. "france|de_balkans").
 * Scope ids must stay in sync with index.html getStandardRegionalButtonDefsForUser_.
 * all_markets: Vojtech — unrestricted market filter (see matchesRegionalMarket_).
 */
var STANDARD_REGIONAL_ALLOWED_SCOPES_BY_EMAIL_ = {
  "vojtech@meavo.com": ["all_markets"],
  "hedi@meavo.com": ["fr_ch", "usa", "iberia", "de_balkans", "czechia"],
  "carla@meavo.com": ["uk"],
  "eftychia@meavo.com": ["uk"],
  "dimitar@meavo.com": ["de_balkans", "france"],
  "rosalia@meavo.com": ["usa"],
  "giulia@meavo.com": ["iberia"]
};

var COLUMN_MAP = {
  RP_NUM: 0,          // A
  ENTRY_DATE: 1,      // B — date logged
  DUE_DATE: 2,        // C
  MARKET: 3,          // D
  USER_ID: 4,         // E
  ISSUE_TYPE: 5,      // F
  URGENCY: 6,         // G
  MODEL: 7,           // H
  BOOTH_ID: 8,        // I
  COLOR: 9,           // J
  ITEM_TYPE: 10,      // K
  QUANTITY: 11,       // L
  PART_RP_CODE: 12,   // M
  PART_DESC: 13,      // N
  CLARIFICATIONS: 14, // O
  NOTES: 15,          // P
  CLIENT: 16,         // Q
  ADDRESS: 17,        // R
  RECIPIENT: 18,      // S
  PHONE: 19,          // T
  EMAIL: 20,          // U
  REVIEW_GROUP: 21,   // V
  SHIP_METHOD: 22,    // W
  STATUS: 23,         // X
  TRACKING: 24,      // Y
  COL_Z: 25,          // Z — date marked Ready (logistics “days since ready”)
  PAYER: 26,          // AA — Платец
  CURRENT_LOCATION: 27, // AB — Current Location
  RP_PHOTO: 28,         // AC — RP Photo (Drive links, newline-separated per item)
  WORKSHOP_NOTE: 29,    // AD — Бележка Цех (factory workshop note)
  ORDER_SENT: 30        // AE — Изпратена Поръчка
};

var PANEL_ORDER_FACTORY_GROUPS_ = ["KAZ", "VAR"];
var PANEL_MISSING_WORKSHOP_NOTE_STANDARD_MIN_AGE_MS_ = 24 * 60 * 60 * 1000;
var FACTORY_PANEL_EXPORT_TITLE_ = {
  KAZ: "Резервни Части KAZ",
  VAR: "Резервни Части VAR"
};
var FACTORY_PANEL_ORDER_VIEWER_EMAIL_ = {
  KAZ: "stefan@meavo.com",
  VAR: "boyan@meavo.com"
};

/** Last 0-based column index the RP app may write on Rep.Parts26 (A–AD). */
var TARGET_SHEET_LAST_WRITABLE_COL_ = COLUMN_MAP.WORKSHOP_NOTE;

function setTargetRowWritableValues_(sheet, rowNum, rowData) {
  var n = TARGET_SHEET_LAST_WRITABLE_COL_ + 1;
  sheet.getRange(rowNum, 1, 1, n).setValues([rowData.slice(0, n)]);
}

function normalizeStatusToken_(status) {
  return normalizeCell_(status).toLowerCase();
}

/** Calendar date (script TZ) as plain "yyyy-MM-dd" text — no Date instant, no TZ projection. */
function readyDateForSheet_() {
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
}

/**
 * Column Z: set ready date when status → Ready; clear when Ready → Briefed.
 * @param {string} [oldStatus] Omit on sheet onEdit when e.oldValue is unavailable.
 */
function syncReadyDateColumnZ_(sheet, rowNum, newStatus, oldStatus) {
  if (!sheet || rowNum <= 1) return;
  var newNorm = normalizeStatusToken_(newStatus);
  var oldNorm = normalizeStatusToken_(oldStatus);
  if (newNorm === oldNorm) return;

  var zRange = sheet.getRange(rowNum, COLUMN_MAP.COL_Z + 1);
  var changed = false;
  if (newNorm === "ready") {
    // Force plain-text format so Sheets does not auto-coerce "2026-05-19" back into
    // a Date serial (which would re-introduce the spurious time component).
    zRange.setNumberFormat("@");
    zRange.setValue(readyDateForSheet_());
    changed = true;
  } else if (oldNorm === "ready" && newNorm === "briefed") {
    zRange.clearContent();
    changed = true;
  }
  if (changed && typeof invalidatePartsCache_ === "function") {
    invalidatePartsCache_();
  }
}

/** Set column X on Rep.Parts26 and sync column Z for Ready / Ready→Briefed. */
function setTargetSheetStatus_(sheet, rowNum, newStatus, oldStatusOpt) {
  var statusRange = sheet.getRange(rowNum, COLUMN_MAP.STATUS + 1);
  var oldStatus = oldStatusOpt != null ? oldStatusOpt : statusRange.getDisplayValue();
  statusRange.setValue(newStatus || "");
  syncReadyDateColumnZ_(sheet, rowNum, newStatus, oldStatus);
}

/** Sheet onEdit: sync Z when column X changes (manual edits). */
function handleTargetSheetStatusOnEdit_(e) {
  if (!e || !e.range || !e.source) return;
  var sheet = e.range.getSheet();
  if (!sheet || sheet.getName() !== CONFIG.TARGET_SHEET) return;
  if (e.range.getColumn() !== COLUMN_MAP.STATUS + 1) return;

  var rowNum = e.range.getRow();
  if (rowNum <= 1) return;

  var rowCount = e.range.getNumRows();
  var colCount = e.range.getNumColumns();
  for (var i = 0; i < rowCount; i++) {
    var r = rowNum + i;
    var newStatus = sheet.getRange(r, COLUMN_MAP.STATUS + 1).getDisplayValue();
    var oldStatus = rowCount === 1 && colCount === 1 ? e.oldValue : "";
    syncReadyDateColumnZ_(sheet, r, newStatus, oldStatus);
  }
}

function normalizeRegionalScopeRequest_(effectiveUserEmail, requestedScope) {
  var emailKey = normalizeCell_(effectiveUserEmail).toLowerCase();
  var allowedList = STANDARD_REGIONAL_ALLOWED_SCOPES_BY_EMAIL_[emailKey];
  if (!allowedList || !allowedList.length) return "";
  var raw = normalizeCell_(requestedScope);
  if (!raw) return "";
  var tokens = raw.split("|").map(function(t) {
    return normalizeCell_(t).toLowerCase();
  }).filter(Boolean);
  var seen = {};
  var out = [];
  for (var i = 0; i < tokens.length; i++) {
    var tok = tokens[i];
    if (allowedList.indexOf(tok) === -1) continue;
    if (seen[tok]) continue;
    seen[tok] = true;
    out.push(tok);
  }
  return out.join("|");
}

function matchesRegionalMarket_(scope, marketCell) {
  if (scope === "all_markets") return true;
  var m = normalizeCell_(marketCell).toLowerCase();
  if (!m) return false;
  if (scope === "fr_ch") return m === "france" || m === "swiss" || m === "switzerland" || m === "ch";
  if (scope === "france") return m === "france";
  if (scope === "uk") {
    return m === "uk" || m === "united kingdom" || m === "great britain" || m === "gb";
  }
  if (scope === "usa") {
    return m === "usa" || m === "united states" || m === "us" || m === "united states of america";
  }
  if (scope === "de_balkans") {
    var countries = [
      "germany", "deutschland", "bulgaria", "croatia", "serbia", "greece",
      "macedonia", "north macedonia", "romania", "slovenia", "albania"
    ];
    return countries.indexOf(m) !== -1;
  }
  if (scope === "iberia") {
    return m === "italy" || m === "spain" || m === "portugal";
  }
  if (scope === "czechia") {
    return m === "czechia" || m === "czech republic" || m === "czech" || m === "cz";
  }
  return false;
}

function getPartsData(viewType, simulatedEmail, regionalScope, ownerFilterEmail, options) {
  var safeViewType = viewType || "active";
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUserEmail = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  var ownPartsMode = options && options.adminOwnLoggedParts === true;
  if (ownPartsMode && !isAdmin) {
    throw new Error("Access denied for admin own-parts view.");
  }

  var sessionLower = normalizeCell_(userEmail).toLowerCase();
  var effLower = normalizeCell_(effectiveUserEmail).toLowerCase();
  var safeRegionalScope = ownPartsMode
    ? ""
    : normalizeRegionalScopeRequest_(effectiveUserEmail, regionalScope);
  var safeOwnerFilter = normalizeCell_(ownerFilterEmail).toLowerCase();
  if (!ownPartsMode) {
    if (safeOwnerFilter && safeOwnerFilter !== effLower) {
      throw new Error("Access denied for owner-filtered view.");
    }
  }

  var viewerNormForRows = ownPartsMode ? sessionLower : (safeOwnerFilter || effLower);
  var reviewerDashboardConfig = ownPartsMode ? null : getReviewerDashboardConfig_(effectiveUserEmail);
  var filterAsReviewer = !!reviewerDashboardConfig;
  var viewerForEditPrivileges = ownPartsMode ? userEmail : effectiveUserEmail;

  var data = getCachedSheetDisplayValues_();
  if (data.length <= 1) return [];
  var colBRawDates = getCachedColumnBRawDates_();

  return data.slice(1)
    .map(function(row, idx) {
      return { row: row, idx: idx };
    })
    .filter(function(entry) {
      var row = entry.row;
      var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
      var loggedByEmail = normalizeCell_(row[COLUMN_MAP.USER_ID]);
      var itemType = normalizeCell_(row[COLUMN_MAP.ITEM_TYPE]);
      var reviewGroup = normalizeCell_(row[COLUMN_MAP.REVIEW_GROUP]);
      var status = normalizeCell_(row[COLUMN_MAP.STATUS]);
      var marketCell = row[COLUMN_MAP.MARKET];

      if (!rpNum) return false;
      if (filterAsReviewer) {
        if (!isReviewerDashboardEligibleRow_(itemType, reviewGroup, reviewerDashboardConfig)) return false;
      } else {
        var ownerNorm = normalizeCell_(loggedByEmail).toLowerCase();
        var viewerNorm = viewerNormForRows;
        if (ownerNorm !== viewerNorm) {
          if (!safeRegionalScope) return false;
        }
        if (safeRegionalScope) {
          var scopeParts = safeRegionalScope.split("|");
          var marketOk = false;
          for (var si = 0; si < scopeParts.length; si++) {
            if (matchesRegionalMarket_(scopeParts[si], marketCell)) {
              marketOk = true;
              break;
            }
          }
          if (!marketOk) return false;
        }
      }

      if (safeViewType === "all") {
        if (filterAsReviewer) {
          var hideArchive = reviewerDashboardConfig && reviewerDashboardConfig.showArchive === false;
          if (hideArchive) {
            if (status === "Cancelled" || status === "Shipped" || isOrderedOnAmazonStatus_(status)) {
              return false;
            }
          }
        }
        return true;
      }
      if (safeViewType === "archive") {
        if (status === "Shipped") return true;
        if (isOrderedOnAmazonStatus_(status)) return !filterAsReviewer;
        return false;
      }
      if (safeViewType === "cancelled") return status === "Cancelled";
      if (safeViewType === "ready") {
        if (!filterAsReviewer) return false;
        return status === "Ready";
      }
      if (filterAsReviewer && safeViewType === "active") {
        return (
          status !== "Shipped" &&
          status !== "Cancelled" &&
          status !== "Ready" &&
          !isOrderedOnAmazonStatus_(status)
        );
      }
      return status !== "Shipped" && status !== "Cancelled" && !isOrderedOnAmazonStatus_(status);
    })
    .map(function(entry) {
      var row = entry.row;
      var editInfo = getRpEditWindowInfo_(
        colBRawDates[entry.idx] || null, // column B raw Date
        row[COLUMN_MAP.USER_ID],
        viewerForEditPrivileges,
        row[COLUMN_MAP.STATUS]
      );
      return applyWorkshopNoteToDashboardPart_({
        rpNum: row[COLUMN_MAP.RP_NUM],
        due: row[COLUMN_MAP.DUE_DATE],
        market: row[COLUMN_MAP.MARKET],
        user: row[COLUMN_MAP.USER_ID],
        issue: row[COLUMN_MAP.ISSUE_TYPE],
        priority: row[COLUMN_MAP.URGENCY],
        model: row[COLUMN_MAP.MODEL],
        boothId: row[COLUMN_MAP.BOOTH_ID],
        color: row[COLUMN_MAP.COLOR],
        itemType: row[COLUMN_MAP.ITEM_TYPE],
        qty: row[COLUMN_MAP.QUANTITY],
        partRpCode: row[COLUMN_MAP.PART_RP_CODE],
        desc: row[COLUMN_MAP.PART_DESC],
        clarification: row[COLUMN_MAP.CLARIFICATIONS],
        note: row[COLUMN_MAP.NOTES],
        client: row[COLUMN_MAP.CLIENT],
        address: row[COLUMN_MAP.ADDRESS],
        recipient: row[COLUMN_MAP.RECIPIENT],
        phone: row[COLUMN_MAP.PHONE],
        email: row[COLUMN_MAP.EMAIL],
        method: row[COLUMN_MAP.SHIP_METHOD],
        status: row[COLUMN_MAP.STATUS],
        tracking: row[COLUMN_MAP.TRACKING],
        reviewGroup: row[COLUMN_MAP.REVIEW_GROUP],
        workshopNote: row[COLUMN_MAP.WORKSHOP_NOTE],
        canEditDueDate: canEditDueDateForViewer_(viewerForEditPrivileges, isAdmin),
        canEditRp: editInfo.canEdit,
        editRpDisabledReason: editInfo.reason,
        items: buildItemsForWeb_(row)
      }, effectiveUserEmail, "rp");
    })
    .sort(function(a, b) {
      var aUrgent = normalizeCell_(a.priority).toLowerCase() === "urgent";
      var bUrgent = normalizeCell_(b.priority).toLowerCase() === "urgent";
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;

      if (filterAsReviewer) {
        return compareDueDates_(a.due, b.due) || (Number(b.rpNum) - Number(a.rpNum));
      }

      if (safeViewType === "active") {
        return Number(b.rpNum) - Number(a.rpNum);
      }
      return Number(b.rpNum) - Number(a.rpNum);
    });
}

function isLogisticsViewerEmail_(email) {
  var key = normalizeCell_(email).toLowerCase();
  return LOGISTICS_VIEWER_EMAILS_[key] === true;
}

function isLogisticsReplacementPartRow_(itemType) {
  return hasAnyToken_(itemType, ["PART", "PARTS", "STOCK", "SPARE"]);
}

function isPalletOrContainerShipMethod_(method) {
  var m = normalizeCell_(method).toLowerCase();
  return m === "pallet" || m === "container";
}

function matchesLogisticsProcessingStatus_(status) {
  var s = normalizeCell_(status);
  if (!s) return true;
  var lower = s.toLowerCase();
  return lower === "briefed" || lower === "in production";
}

function matchesLogisticsViewFilter_(status, logisticsView) {
  var s = normalizeCell_(status);
  var lower = s.toLowerCase();
  if (logisticsView === "processing") {
    return matchesLogisticsProcessingStatus_(status);
  }
  if (logisticsView === "ready") return lower === "ready";
  if (logisticsView === "shipped") return lower === "shipped";
  return false;
}

/**
 * Column Y text from ExportAutomation: "{shipping week / header} Pallet {key}".
 */
function parseTrackingForLogistics_(tracking) {
  var t = normalizeCell_(tracking);
  if (!t) return { shippingWeek: "", pallet: "" };
  var m = t.match(/^(.+?)\s+Pallet\s+(.+)$/i);
  if (m) {
    return { shippingWeek: normalizeCell_(m[1]), pallet: normalizeCell_(m[2]) };
  }
  var m2 = t.match(/\bPallet\s+(\S+)\s*$/i);
  if (m2) {
    var pallet = normalizeCell_(m2[1]);
    var week = t.replace(/\s*Pallet\s+\S+\s*$/i, "").trim();
    return { shippingWeek: week, pallet: pallet };
  }
  return { shippingWeek: t, pallet: "" };
}

function computeDaysSinceReadyFromZ_(zCellValue) {
  var raw = normalizeCell_(zCellValue);
  if (!raw) return null;
  var d = parseDueDate_(raw);
  if (!d) return null;
  var tz = Session.getScriptTimeZone();
  var todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  var readyStr = Utilities.formatDate(d, tz, "yyyy-MM-dd");
  var todayParts = todayStr.split("-");
  var readyParts = readyStr.split("-");
  var t0 = new Date(Number(todayParts[0]), Number(todayParts[1]) - 1, Number(todayParts[2])).getTime();
  var t1 = new Date(Number(readyParts[0]), Number(readyParts[1]) - 1, Number(readyParts[2])).getTime();
  return Math.floor((t0 - t1) / (24 * 60 * 60 * 1000));
}

function normalizeRpKeyForLookup_(rpNum) {
  var raw = normalizeCell_(rpNum);
  if (!raw) return "";
  var match = raw.match(/RP-(\d+)/i);
  if (match) return "RP-" + Number(match[1]);
  if (/^\d+$/.test(raw)) return "RP-" + Number(raw);
  return raw;
}

/**
 * Internal Production column S (source RP) -> column M (warehouse) for logistics STOCK display.
 */
function buildInternalProductionWarehouseBySourceRp_() {
  var map = {};
  var ipSheet;
  try {
    ipSheet = getInternalProductionSheet_();
  } catch (err) {
    return map;
  }
  var lastRow = ipSheet.getLastRow();
  if (lastRow < 2) return map;

  var width = INTERNAL_PRODUCTION_LAST_COL_;
  var data = ipSheet.getRange(2, 1, lastRow, width).getDisplayValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var sourceRpKey = normalizeRpKeyForLookup_(row[INTERNAL_PRODUCTION_COL.SOURCE_RP - 1]);
    var warehouse = normalizeCell_(row[INTERNAL_PRODUCTION_COL.WAREHOUSE - 1]);
    if (!sourceRpKey || !warehouse) continue;
    map[sourceRpKey] = warehouse;
  }
  return map;
}

function resolveLogisticsFactoryDisplay_(rpNum, reviewGroup, warehouseBySourceRp) {
  var groupUpper = normalizeCell_(reviewGroup).toUpperCase();
  if (groupUpper !== "STOCK") {
    return normalizeCell_(reviewGroup) || "—";
  }
  var rpKey = normalizeRpKeyForLookup_(rpNum);
  if (rpKey && warehouseBySourceRp[rpKey]) {
    return warehouseBySourceRp[rpKey];
  }
  return normalizeCell_(reviewGroup) || "—";
}

function normalizePanelExportFactoryCode_(value) {
  var upper = normalizeCell_(value).toUpperCase();
  if (upper === "KAZ" || upper === "VAR" || upper === "AKS") return upper;
  if (hasAnyToken_(value, ["KAZ"])) return "KAZ";
  if (hasAnyToken_(value, ["VAR"])) return "VAR";
  if (hasAnyToken_(value, ["AKS"])) return "AKS";
  return "";
}

function isStockPayerValue_(value) {
  return normalizeCell_(value).toUpperCase() === "STOCK";
}

function buildInternalProductionFactoryBySourceRp_() {
  var map = {};
  var ipSheet;
  try {
    ipSheet = getInternalProductionSheet_();
  } catch (err) {
    return map;
  }
  var lastRow = ipSheet.getLastRow();
  if (lastRow < 2) return map;

  var width = INTERNAL_PRODUCTION_LAST_COL_;
  var data = ipSheet.getRange(2, 1, lastRow, width).getDisplayValues();
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var sourceRpKey = normalizeRpKeyForLookup_(row[INTERNAL_PRODUCTION_COL.SOURCE_RP - 1]);
    if (!sourceRpKey || map[sourceRpKey]) continue;
    var factory = normalizePanelExportFactoryCode_(row[INTERNAL_PRODUCTION_COL.FACTORY - 1]);
    if (!factory) {
      factory = deduceFactoryFromBatch_(row[INTERNAL_PRODUCTION_COL.BATCH - 1]);
    }
    if (factory) map[sourceRpKey] = factory;
  }
  return map;
}

function resolvePanelExportFactoryForEntry_(entry, factoryBySourceRp) {
  entry = entry || {};
  var fromEntry = normalizePanelExportFactoryCode_(entry.factory) ||
    normalizePanelExportFactoryCode_(entry.reviewGroup);
  if (fromEntry) return fromEntry;

  if (normalizeCell_(entry.recordType).toLowerCase() === "ip") {
    var fromBatch = deduceFactoryFromBatch_(entry.batch);
    if (fromBatch) return fromBatch;
  }

  factoryBySourceRp = factoryBySourceRp || buildInternalProductionFactoryBySourceRp_();
  var lookupRp = normalizeCell_(entry.recordType).toLowerCase() === "ip"
    ? normalizeCell_(entry.sourceRp)
    : normalizeCell_(entry.rpNum);
  var rpKey = normalizeRpKeyForLookup_(lookupRp);
  if (rpKey && factoryBySourceRp[rpKey]) {
    return factoryBySourceRp[rpKey];
  }

  if (rpKey) {
    var rpRow = getRpDisplayRowByRpNum_(lookupRp);
    if (rpRow) {
      var fromRpGroup = normalizePanelExportFactoryCode_(rpRow[COLUMN_MAP.REVIEW_GROUP]);
      if (fromRpGroup) return fromRpGroup;
    }
  }
  return "";
}

function resolvePanelExportPayerValue_(payerValue, entry, factoryBySourceRp) {
  if (!isStockPayerValue_(payerValue)) return payerValue;
  var factory = resolvePanelExportFactoryForEntry_(entry, factoryBySourceRp);
  return factory || payerValue;
}

function getLogisticsPartsData(logisticsView, simulatedEmail) {
  var safeView = normalizeCell_(logisticsView).toLowerCase() || "ready";
  if (safeView !== "processing" && safeView !== "ready" && safeView !== "shipped" && safeView !== "all") {
    safeView = "ready";
  }

  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUserEmail = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isLogisticsViewerEmail_(effectiveUserEmail)) {
    throw new Error("Access denied for logistics view.");
  }

  var data = getCachedSheetDisplayValues_();
  if (data.length <= 1) return [];
  var warehouseBySourceRp = buildInternalProductionWarehouseBySourceRp_();

  var rows = data.slice(1).filter(function(row) {
    var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
    if (!rpNum) return false;
    if (safeView === "all") {
      return (
        matchesLogisticsViewFilter_(row[COLUMN_MAP.STATUS], "processing") ||
        matchesLogisticsViewFilter_(row[COLUMN_MAP.STATUS], "ready") ||
        matchesLogisticsViewFilter_(row[COLUMN_MAP.STATUS], "shipped")
      );
    }
    return matchesLogisticsViewFilter_(row[COLUMN_MAP.STATUS], safeView);
  });

  var parsed = rows.map(function(row) {
    var trackingRaw = normalizeCell_(row[COLUMN_MAP.TRACKING]);
    var parsedY = parseTrackingForLogistics_(trackingRaw);
    var daysSinceReady = computeDaysSinceReadyFromZ_(row[COLUMN_MAP.COL_Z]);
    return {
      rpNum: row[COLUMN_MAP.RP_NUM],
      due: row[COLUMN_MAP.DUE_DATE],
      market: row[COLUMN_MAP.MARKET],
      reviewGroup: row[COLUMN_MAP.REVIEW_GROUP],
      factoryDisplay: resolveLogisticsFactoryDisplay_(
        row[COLUMN_MAP.RP_NUM],
        row[COLUMN_MAP.REVIEW_GROUP],
        warehouseBySourceRp
      ),
      user: row[COLUMN_MAP.USER_ID],
      issue: row[COLUMN_MAP.ISSUE_TYPE],
      priority: row[COLUMN_MAP.URGENCY],
      model: row[COLUMN_MAP.MODEL],
      boothId: row[COLUMN_MAP.BOOTH_ID],
      color: row[COLUMN_MAP.COLOR],
      itemType: row[COLUMN_MAP.ITEM_TYPE],
      qty: row[COLUMN_MAP.QUANTITY],
      partRpCode: row[COLUMN_MAP.PART_RP_CODE],
      desc: row[COLUMN_MAP.PART_DESC],
      clarification: row[COLUMN_MAP.CLARIFICATIONS],
      note: row[COLUMN_MAP.NOTES],
      client: row[COLUMN_MAP.CLIENT],
      address: row[COLUMN_MAP.ADDRESS],
      recipient: row[COLUMN_MAP.RECIPIENT],
      phone: row[COLUMN_MAP.PHONE],
      email: row[COLUMN_MAP.EMAIL],
      method: row[COLUMN_MAP.SHIP_METHOD],
      status: row[COLUMN_MAP.STATUS],
      tracking: trackingRaw,
      shippingWeek: parsedY.shippingWeek,
      pallet: parsedY.pallet,
      daysSinceReady: daysSinceReady,
      items: buildItemsForWeb_(row)
    };
  });

  parsed.sort(function(a, b) {
    if (safeView === "processing") {
      var cd = compareDueDates_(a.due, b.due);
      if (cd) return cd;
      return Number(b.rpNum) - Number(a.rpNum);
    }
    if (safeView === "ready") {
      var aUrgent = normalizeCell_(a.priority).toLowerCase() === "urgent";
      var bUrgent = normalizeCell_(b.priority).toLowerCase() === "urgent";
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
    }
    var da = a.daysSinceReady;
    var db = b.daysSinceReady;
    if (da == null && db == null) return Number(b.rpNum) - Number(a.rpNum);
    if (da == null) return 1;
    if (db == null) return -1;
    if (db !== da) return db - da;
    return Number(b.rpNum) - Number(a.rpNum);
  });

  return parsed;
}

function isTodorDashboardViewerEmail_(email) {
  var key = normalizeCell_(email).toLowerCase();
  return TODOR_DASHBOARD_VIEWER_EMAILS_[key] === true;
}

function isIvanDashboardViewerEmail_(email) {
  var key = normalizeCell_(email).toLowerCase();
  return IVAN_DASHBOARD_VIEWER_EMAILS_[key] === true;
}

function getIvanDashboardData(viewType, simulatedEmail) {
  var safeView = normalizeCell_(viewType).toLowerCase() || "active";
  if (safeView !== "active" && safeView !== "ready" && safeView !== "archive" && safeView !== "all") {
    safeView = "active";
  }

  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUserEmail = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isIvanDashboardViewerEmail_(effectiveUserEmail)) {
    throw new Error("Access denied for Ivan dashboard.");
  }

  var data = getCachedSheetDisplayValues_();
  if (data.length <= 1) return [];
  var colBRawDates = getCachedColumnBRawDates_();

  return data.slice(1)
    .map(function(row, idx) {
      return { row: row, idx: idx };
    })
    .filter(function(entry) {
      var row = entry.row;
      var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
      if (!rpNum) return false;
      var reviewGroup = normalizeCell_(row[COLUMN_MAP.REVIEW_GROUP]).toUpperCase();
      if (reviewGroup !== "AKS" && reviewGroup !== "VAR" && reviewGroup !== "KAZ") return false;
      var status = normalizeCell_(row[COLUMN_MAP.STATUS]);
      if (safeView === "all") {
        if (status === "Cancelled") return false;
        if (isOrderedOnAmazonStatus_(status)) return false;
        return true;
      }
      if (safeView === "ready") return status === "Ready";
      if (safeView === "archive") return status === "Shipped";
      if (status === "Cancelled") return false;
      if (isOrderedOnAmazonStatus_(status)) return false;
      return status !== "Ready" && status !== "Shipped";
    })
    .map(function(entry) {
      var row = entry.row;
      var editInfo = getRpEditWindowInfo_(
        colBRawDates[entry.idx] || null, // column B raw Date
        row[COLUMN_MAP.USER_ID],
        effectiveUserEmail,
        row[COLUMN_MAP.STATUS]
      );
      return applyWorkshopNoteToDashboardPart_({
        rpNum: row[COLUMN_MAP.RP_NUM],
        due: row[COLUMN_MAP.DUE_DATE],
        market: row[COLUMN_MAP.MARKET],
        user: row[COLUMN_MAP.USER_ID],
        issue: row[COLUMN_MAP.ISSUE_TYPE],
        priority: row[COLUMN_MAP.URGENCY],
        model: row[COLUMN_MAP.MODEL],
        boothId: row[COLUMN_MAP.BOOTH_ID],
        color: row[COLUMN_MAP.COLOR],
        itemType: row[COLUMN_MAP.ITEM_TYPE],
        qty: row[COLUMN_MAP.QUANTITY],
        partRpCode: row[COLUMN_MAP.PART_RP_CODE],
        desc: row[COLUMN_MAP.PART_DESC],
        clarification: row[COLUMN_MAP.CLARIFICATIONS],
        note: row[COLUMN_MAP.NOTES],
        client: row[COLUMN_MAP.CLIENT],
        address: row[COLUMN_MAP.ADDRESS],
        recipient: row[COLUMN_MAP.RECIPIENT],
        phone: row[COLUMN_MAP.PHONE],
        email: row[COLUMN_MAP.EMAIL],
        method: row[COLUMN_MAP.SHIP_METHOD],
        status: row[COLUMN_MAP.STATUS],
        tracking: row[COLUMN_MAP.TRACKING],
        reviewGroup: row[COLUMN_MAP.REVIEW_GROUP],
        workshopNote: row[COLUMN_MAP.WORKSHOP_NOTE],
        canEditDueDate: false,
        canEditRp: editInfo.canEdit,
        editRpDisabledReason: editInfo.reason,
        items: buildItemsForWeb_(row)
      }, effectiveUserEmail, "rp");
    })
    .sort(function(a, b) {
      return Number(b.rpNum) - Number(a.rpNum);
    });
}

function padTwoDigit_(n) {
  var s = String(n);
  return s.length < 2 ? "0" + s : s;
}

/** ISO week number and 2-digit year suffix in script timezone. */
function getIsoWeekContext_(dateOpt) {
  var d = dateOpt || new Date();
  var tz = Session.getScriptTimeZone();
  var localStr = Utilities.formatDate(d, tz, "yyyy-MM-dd");
  var parts = localStr.split("-");
  var y = Number(parts[0]);
  var mo = Number(parts[1]) - 1;
  var day = Number(parts[2]);
  var local = new Date(y, mo, day);
  var dayNum = local.getDay() || 7;
  local.setDate(local.getDate() + 4 - dayNum);
  var isoYear = local.getFullYear();
  var yearStart = new Date(isoYear, 0, 1);
  var weekNum = Math.ceil(((local.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return {
    isoYear: isoYear,
    weekNum: weekNum,
    yearSuffix: padTwoDigit_(isoYear % 100)
  };
}

function getNextIsoWeekContext_() {
  var d = new Date();
  d.setDate(d.getDate() + 7);
  return getIsoWeekContext_(d);
}

function parseShippingWeekCode_(raw) {
  var compact = normalizeCell_(raw).toUpperCase().replace(/\s+/g, "");
  if (!compact) return null;
  var m = compact.match(/^(VS|AS|KS)(\d{2})-(\d{1,2})$/);
  if (!m) return null;
  var factoryCode = m[1];
  return {
    raw: normalizeCell_(raw),
    factoryCode: factoryCode,
    factoryName: SHIPPING_WEEK_FACTORY_NAMES_[factoryCode] || "",
    yearSuffix: m[2],
    weekNum: Number(m[3])
  };
}

function formatShippingWeekCode_(factoryCode, yearSuffix, weekNum) {
  return factoryCode + yearSuffix + "-" + weekNum;
}

function buildExpectedShippingWeekCodes_(ctx) {
  return {
    VS: formatShippingWeekCode_("VS", ctx.yearSuffix, ctx.weekNum),
    AS: formatShippingWeekCode_("AS", ctx.yearSuffix, ctx.weekNum)
  };
}

function matchesIsoWeekContext_(entry, ctx) {
  if (!entry || !ctx) return false;
  return entry.yearSuffix === ctx.yearSuffix && entry.weekNum === ctx.weekNum;
}

/** Flat schedule rows from Износ (col A week, G pallet, M RP codes). VS/AS only. */
function buildIznosRpScheduleEntries_() {
  var cfg = typeof EXPORT_AUTOMATION_CONFIG !== "undefined" ? EXPORT_AUTOMATION_CONFIG : null;
  if (!cfg) return [];

  var sourceSheet = SpreadsheetApp
    .openById(cfg.SOURCE_SPREADSHEET_ID)
    .getSheetByName(cfg.SOURCE_SHEET_NAME);
  if (!sourceSheet) return [];

  var sourceLastRow = sourceSheet.getLastRow();
  if (sourceLastRow < cfg.SOURCE_START_ROW) return [];

  var sectionHeaderBySourceRow = buildSectionHeaderMap_(sourceSheet, sourceLastRow);
  var sourceEntries = buildSourceEntries_(sourceSheet, sourceLastRow);
  var out = [];

  for (var i = 0; i < sourceEntries.length; i++) {
    var entry = sourceEntries[i];
    var headerRaw = normalizeCell_(sectionHeaderBySourceRow[entry.rowNum]);
    if (!headerRaw) continue;
    var parsed = parseShippingWeekCode_(headerRaw);
    if (!parsed || !TODOR_SHIPPING_FACTORY_CODES_[parsed.factoryCode]) continue;

    for (var r = 0; r < entry.rpCodes.length; r++) {
      var lookupKey = normalizeTodorRpLookupKey_(entry.rpCodes[r]);
      if (!lookupKey) continue;
      out.push({
        rpCode: lookupKey,
        shippingWeekRaw: parsed.raw || headerRaw,
        factoryCode: parsed.factoryCode,
        factoryName: parsed.factoryName,
        yearSuffix: parsed.yearSuffix,
        weekNum: parsed.weekNum,
        pallet: entry.palletKey
      });
    }
  }
  return out;
}

function isTodorExcludedStatus_(status) {
  var lower = normalizeCell_(status).toLowerCase();
  return lower === "shipped" || lower === "cancelled";
}

/** Cancelled only — Shipped rows still supply RP details for Износ. */
function isTodorCancelledStatus_(status) {
  return normalizeCell_(status).toLowerCase() === "cancelled";
}

/**
 * Canonical RP key for joining Износ codes to Rep.Parts26 column A.
 * Does not use global normalizeRpCode_ (LoggerLogic defines a different function).
 */
function normalizeTodorRpLookupKey_(value) {
  var raw = normalizeCell_(value);
  if (!raw) return "";
  var upper = raw.toUpperCase().replace(/[\u2013\u2014]/g, "-");
  var m = upper.match(/RP\s*-?\s*(\d+)/);
  if (m) return "RP-" + Number(m[1]);
  var digits = upper.replace(/\D/g, "");
  if (digits) return "RP-" + Number(digits);
  return upper;
}

function resolveTodorDashboardViews_(view, subView) {
  var main = normalizeCell_(view).toLowerCase();
  var sub = normalizeCell_(subView).toLowerCase();
  if (main === "this_week" || main === "next_week") {
    return { main: "iznos", iznosWeek: main };
  }
  if (main === "topoli") {
    return { main: "availability", iznosWeek: "this_week" };
  }
  if (main === "iznos") {
    return { main: "iznos", iznosWeek: sub === "next_week" ? "next_week" : "this_week" };
  }
  if (main === "availability") {
    return { main: "availability", iznosWeek: "this_week" };
  }
  if (main === "ip") {
    return { main: "ip", iznosWeek: "this_week" };
  }
  if (main === "all") {
    return { main: "all", iznosWeek: "this_week" };
  }
  return { main: "iznos", iznosWeek: "this_week" };
}

function buildTodorPartDetailsFromRow_(row) {
  return {
    rpNum: row[COLUMN_MAP.RP_NUM],
    due: row[COLUMN_MAP.DUE_DATE],
    priority: row[COLUMN_MAP.URGENCY],
    model: row[COLUMN_MAP.MODEL],
    boothId: row[COLUMN_MAP.BOOTH_ID],
    color: row[COLUMN_MAP.COLOR],
    clarification: row[COLUMN_MAP.CLARIFICATIONS],
    note: row[COLUMN_MAP.NOTES],
    status: row[COLUMN_MAP.STATUS],
    method: row[COLUMN_MAP.SHIP_METHOD],
    itemType: row[COLUMN_MAP.ITEM_TYPE],
    items: buildItemsForWeb_(row),
    hasSheetDetails: true
  };
}

function buildTodorRpDetailsIndex_() {
  var index = {};
  var data = getCachedSheetDisplayValues_();
  if (data.length <= 1) return index;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
    var key = normalizeTodorRpLookupKey_(rpNum);
    if (!key) continue;
    if (isTodorCancelledStatus_(row[COLUMN_MAP.STATUS])) continue;

    var details = buildTodorPartDetailsFromRow_(row);
    var methodLower = normalizeCell_(row[COLUMN_MAP.SHIP_METHOD]).toLowerCase();
    var isPalletOrContainer = methodLower === "pallet" || methodLower === "container";

    if (!index[key]) {
      index[key] = details;
      continue;
    }
    var existingMethod = normalizeCell_(index[key].method).toLowerCase();
    var existingIsPallet = existingMethod === "pallet" || existingMethod === "container";
    if (isPalletOrContainer && !existingIsPallet) {
      index[key] = details;
    }
  }
  return index;
}

function mergeTodorScheduleWithDetails_(scheduleEntries, detailsIndex) {
  var out = [];
  for (var i = 0; i < scheduleEntries.length; i++) {
    var sched = scheduleEntries[i];
    var key = normalizeTodorRpLookupKey_(sched.rpCode);
    var details = detailsIndex[key];
    out.push({
      recordType: "rp",
      rpNum: details ? details.rpNum : sched.rpCode,
      rpCode: sched.rpCode,
      due: details ? details.due : "",
      priority: details ? details.priority : "",
      model: details ? details.model : "",
      boothId: details ? details.boothId : "",
      color: details ? details.color : "",
      clarification: details ? details.clarification : "",
      note: details ? details.note : "",
      status: details ? details.status : "",
      method: details ? details.method : "",
      itemType: details ? details.itemType : "",
      items: details ? details.items : [],
      hasSheetDetails: !!details,
      shippingWeek: sched.shippingWeekRaw,
      shippingWeekCode: sched.shippingWeekRaw,
      factoryCode: sched.factoryCode,
      factoryName: sched.factoryName,
      pallet: sched.pallet
    });
  }
  return out;
}

function buildTopoliWarehouseParts_() {
  var data = getCachedSheetDisplayValues_();
  if (data.length <= 1) return [];

  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
    if (!rpNum) continue;
    if (isTodorExcludedStatus_(row[COLUMN_MAP.STATUS])) continue;
    var loc = normalizeCell_(row[COLUMN_MAP.CURRENT_LOCATION]).toLowerCase();
    if (loc !== TOPOLI_WAREHOUSE_LOCATION_) continue;

    var part = buildTodorPartDetailsFromRow_(row);
    part.recordType = "rp";
    part.shippingWeek = "";
    part.shippingWeekCode = "";
    part.factoryCode = "";
    part.factoryName = normalizeCell_(row[COLUMN_MAP.REVIEW_GROUP]) || "";
    part.pallet = "";
    out.push(part);
  }
  return out;
}

function isTopoliWarehouseName_(warehouse) {
  return normalizeCell_(warehouse).toLowerCase() === "topoli";
}

function buildTopoliInternalProductionParts_() {
  var sheet = getInternalProductionSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var width = INTERNAL_PRODUCTION_LAST_COL_;
  var data = sheet.getRange(2, 1, lastRow, width).getDisplayValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!isInternalProductionRowPopulated_(row)) continue;
    if (!isTopoliWarehouseName_(row[INTERNAL_PRODUCTION_COL.WAREHOUSE - 1])) continue;
    var statusLower = normalizeCell_(row[INTERNAL_PRODUCTION_COL.STATUS - 1]).toLowerCase();
    if (statusLower === "cancelled" || statusLower === "delivered") continue;

    var part = mapInternalProductionRowToDashboard_(row, {});
    part.hasSheetDetails = true;
    part.recordType = "ip";
    out.push(part);
  }
  return out;
}

function sortTodorDashboardParts_(parts) {
  parts.sort(function(a, b) {
    var aUrgent = normalizeCell_(a.priority).toLowerCase() === "urgent";
    var bUrgent = normalizeCell_(b.priority).toLowerCase() === "urgent";
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    var aNum = Number(String(a.rpNum || "").replace(/\D/g, "")) || 0;
    var bNum = Number(String(b.rpNum || "").replace(/\D/g, "")) || 0;
    if (bNum !== aNum) return bNum - aNum;
    return String(a.pallet || "").localeCompare(String(b.pallet || ""));
  });
  return parts;
}

function getTodorDashboardData(view, subViewOrSim, simulatedEmailOpt) {
  var subView = "";
  var simulatedEmail = "";
  if (simulatedEmailOpt != null && String(simulatedEmailOpt) !== "") {
    subView = subViewOrSim;
    simulatedEmail = simulatedEmailOpt;
  } else if (/@meavo\.com$/i.test(normalizeCell_(subViewOrSim).toLowerCase())) {
    simulatedEmail = subViewOrSim;
  } else {
    subView = subViewOrSim;
  }

  var resolved = resolveTodorDashboardViews_(view, subView);

  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUserEmail = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isTodorDashboardViewerEmail_(effectiveUserEmail)) {
    throw new Error("Access denied for Todor dashboard.");
  }

  var currentCtx = getIsoWeekContext_();
  var nextCtx = getNextIsoWeekContext_();
  var expectedCurrent = buildExpectedShippingWeekCodes_(currentCtx);
  var expectedNext = buildExpectedShippingWeekCodes_(nextCtx);
  var parts = [];

  if (resolved.main === "all") {
    var detailsIndexAll = buildTodorRpDetailsIndex_();
    parts = mergeTodorScheduleWithDetails_(buildIznosRpScheduleEntries_(), detailsIndexAll);
    parts = parts.concat(buildTopoliWarehouseParts_());
    parts = parts.concat(buildTopoliInternalProductionParts_());
    var seenRpKeys = {};
    parts = parts.filter(function(part) {
      var key = normalizeTodorRpLookupKey_(part.rpNum || part.rpCode);
      if (!key || seenRpKeys[key]) return false;
      seenRpKeys[key] = true;
      return true;
    });
    sortTodorDashboardParts_(parts);
  } else if (resolved.main === "availability") {
    parts = buildTopoliWarehouseParts_();
    sortTodorDashboardParts_(parts);
  } else if (resolved.main === "ip") {
    parts = buildTopoliInternalProductionParts_();
    parts.sort(sortNikolayDashboardEntries_);
  } else {
    var ctx = resolved.iznosWeek === "next_week" ? nextCtx : currentCtx;
    var schedule = buildIznosRpScheduleEntries_().filter(function(entry) {
      return matchesIsoWeekContext_(entry, ctx);
    });
    var detailsIndex = buildTodorRpDetailsIndex_();
    parts = mergeTodorScheduleWithDetails_(schedule, detailsIndex);
    sortTodorDashboardParts_(parts);
  }

  return {
    parts: parts,
    meta: {
      mainView: resolved.main,
      iznosWeek: resolved.iznosWeek,
      isoWeek: currentCtx.weekNum,
      isoYear: currentCtx.isoYear,
      nextIsoWeek: nextCtx.weekNum,
      nextIsoYear: nextCtx.isoYear,
      expectedVarThisWeek: expectedCurrent.VS,
      expectedAksThisWeek: expectedCurrent.AS,
      expectedVarNextWeek: expectedNext.VS,
      expectedAksNextWeek: expectedNext.AS
    }
  };
}

function getRpEditWindowInfo_(entryDateValue, rowOwnerEmail, viewerEmail, status) {
  var ownerNorm = normalizeCell_(rowOwnerEmail).toLowerCase();
  var viewerNorm = normalizeCell_(viewerEmail).toLowerCase();
  if (!ownerNorm || ownerNorm !== viewerNorm) {
    return { canEdit: false, reason: "" };
  }

  var statusNorm = normalizeCell_(status);
  if (statusNorm === "Shipped" || statusNorm === "Cancelled" || isOrderedOnAmazonStatus_(statusNorm)) {
    return { canEdit: false, reason: RP_EDIT_WINDOW_EXPIRED_MSG_ };
  }

  var entryDate = entryDateValue instanceof Date ? entryDateValue : new Date(entryDateValue);
  if (!(entryDate instanceof Date) || isNaN(entryDate.getTime())) {
    return { canEdit: false, reason: RP_EDIT_WINDOW_EXPIRED_MSG_ };
  }

  var elapsedMs = new Date().getTime() - entryDate.getTime();
  if (elapsedMs <= RP_EDIT_WINDOW_MS_) {
    return { canEdit: true, reason: "" };
  }
  return { canEdit: false, reason: RP_EDIT_WINDOW_EXPIRED_MSG_ };
}

function isActiveUrgentPanelsUser_(email) {
  var e = normalizeCell_(email).toLowerCase();
  return ACTIVE_URGENT_PANELS_EMAILS_[e] === true;
}

function getActiveUrgentPanelsData(simulatedEmail, panelView) {
  var currentUser = normalizeCell_(Session.getActiveUser().getEmail()).toLowerCase();
  var isAdmin = isAdminUser_(currentUser);
  var effectiveUser = getEffectiveUserEmail_(currentUser, simulatedEmail, isAdmin);
  if (!isActiveUrgentPanelsUser_(effectiveUser)) {
    throw new Error("Access denied for active urgent panels view.");
  }
  var safePanelView = normalizeCell_(panelView).toLowerCase() || "unbriefed";

  var data = getCachedSheetDisplayValues_();
  if (data.length <= 1) {
    return { AKS: [], VAR: [], KAZ: [] };
  }

  var grouped = { AKS: [], VAR: [], KAZ: [] };
  data.slice(1).forEach(function(row) {
    var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
    var urgency = normalizeCell_(row[COLUMN_MAP.URGENCY]).toLowerCase();
    var itemType = normalizeCell_(row[COLUMN_MAP.ITEM_TYPE]).toUpperCase();
    var reviewGroup = normalizeCell_(row[COLUMN_MAP.REVIEW_GROUP]).toUpperCase();
    var status = normalizeCell_(row[COLUMN_MAP.STATUS]);

    if (!rpNum) return;
    if (urgency !== "urgent") return;
    if (itemType === "PART" || itemType === "PARTS" || itemType === "SPARE") return;
    if (!grouped.hasOwnProperty(reviewGroup)) return;
    if (!matchesActiveUrgentPanelsStatus_(status, safePanelView)) return;

    grouped[reviewGroup].push(applyWorkshopNoteToDashboardPart_({
      rpNum: row[COLUMN_MAP.RP_NUM],
      reviewGroup: reviewGroup,
      boothId: row[COLUMN_MAP.BOOTH_ID],
      color: row[COLUMN_MAP.COLOR],
      itemType: row[COLUMN_MAP.ITEM_TYPE],
      qtyAndPanel: buildQtyAndPanelText_(row[COLUMN_MAP.QUANTITY], row[COLUMN_MAP.ITEM_TYPE]),
      notes: row[COLUMN_MAP.CLARIFICATIONS],
      client: row[COLUMN_MAP.CLIENT],
      due: row[COLUMN_MAP.DUE_DATE],
      status: row[COLUMN_MAP.STATUS],
      workshopNote: row[COLUMN_MAP.WORKSHOP_NOTE]
    }, effectiveUser, "rp"));
  });

  Object.keys(grouped).forEach(function(key) {
    grouped[key].sort(function(a, b) {
      return compareDueDates_(a.due, b.due) || (Number(b.rpNum) - Number(a.rpNum));
    });
  });

  return grouped;
}

function briefActiveUrgentPanel(rpNum, productionEta, simulatedEmail) {
  var currentUser = normalizeCell_(Session.getActiveUser().getEmail()).toLowerCase();
  var isAdmin = isAdminUser_(currentUser);
  var effectiveUser = getEffectiveUserEmail_(currentUser, simulatedEmail, isAdmin);
  if (!isActiveUrgentPanelsUser_(effectiveUser)) {
    throw new Error("Access denied for active urgent panels view.");
  }

  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";
  var sheet = getTargetSheet_();
  setTargetSheetStatus_(sheet, rowNum, "In Production");
  sheet.getRange(rowNum, COLUMN_MAP.DUE_DATE + 1).setValue(productionEta || "");
  invalidatePartsCache_();
  try {
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("briefActiveUrgentPanel Slack sync: " + slackErr);
  }
  return "Briefed";
}

function updateActiveUrgentPanelsEta(rpNum, newDate, simulatedEmail) {
  var currentUser = normalizeCell_(Session.getActiveUser().getEmail()).toLowerCase();
  var isAdmin = isAdminUser_(currentUser);
  var effectiveUser = getEffectiveUserEmail_(currentUser, simulatedEmail, isAdmin);
  if (!isActiveUrgentPanelsUser_(effectiveUser)) {
    throw new Error("Access denied for active urgent panels view.");
  }

  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";
  var sheet = getTargetSheet_();
  sheet.getRange(rowNum, COLUMN_MAP.DUE_DATE + 1).setValue(newDate || "");
  invalidatePartsCache_();
  try {
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("updateActiveUrgentPanelsEta Slack sync: " + slackErr);
  }
  return "ETA updated";
}

function isUsaMarket_(marketCell) {
  var m = normalizeCell_(marketCell).toLowerCase();
  return m === "usa" || m === "united states" || m === "us" || m === "united states of america";
}

/** Ship method when urgent panel is marked Ready (export automation requires Pallet or Container in W). */
function getUrgentPanelReadyShipMethod_(marketCell) {
  return isUsaMarket_(marketCell) ? "Container" : "Pallet";
}

function markActiveUrgentPanelReady(rpNum, simulatedEmail) {
  var currentUser = normalizeCell_(Session.getActiveUser().getEmail()).toLowerCase();
  var isAdmin = isAdminUser_(currentUser);
  var effectiveUser = getEffectiveUserEmail_(currentUser, simulatedEmail, isAdmin);
  if (!isActiveUrgentPanelsUser_(effectiveUser)) {
    throw new Error("Access denied for active urgent panels view.");
  }

  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";

  var sheet = getTargetSheet_();
  var market = sheet.getRange(rowNum, COLUMN_MAP.MARKET + 1).getDisplayValue();
  sheet.getRange(rowNum, COLUMN_MAP.SHIP_METHOD + 1).setValue(getUrgentPanelReadyShipMethod_(market));
  setTargetSheetStatus_(sheet, rowNum, "Ready");
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  try {
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("markActiveUrgentPanelReady Slack sync: " + slackErr);
  }
  try {
    if (typeof notifyUrgentPanelReadyForPalletShipping_ === "function") {
      notifyUrgentPanelReadyForPalletShipping_(sheet, rowNum);
    }
  } catch (shipSlackErr) {
    Logger.log("markActiveUrgentPanelReady shipping Slack: " + shipSlackErr);
  }
  return "Ready";
}

var USED_EXISTING_PANEL_WAREHOUSES_ = {
  "Topoli": true,
  "Alliance": true,
  "NY Warehouse": true,
  "SF Warehouse": true
};

function useExistingUrgentPanel(rpNum, batch, color, warehouse, simulatedEmail) {
  var currentUser = normalizeCell_(Session.getActiveUser().getEmail()).toLowerCase();
  var isAdmin = isAdminUser_(currentUser);
  var effectiveUser = getEffectiveUserEmail_(currentUser, simulatedEmail, isAdmin);
  if (!isActiveUrgentPanelsUser_(effectiveUser)) {
    throw new Error("Access denied for active urgent panels view.");
  }

  var safeBatch = normalizeCell_(batch);
  var safeColor = normalizeCell_(color);
  var safeWarehouse = normalizeCell_(warehouse);
  if (!safeBatch) throw new Error("Batch is required.");
  if (!safeColor) throw new Error("Colour is required.");
  if (!safeWarehouse || !USED_EXISTING_PANEL_WAREHOUSES_[safeWarehouse]) {
    throw new Error("Warehouse is required.");
  }

  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";

  var sheet = getTargetSheet_();
  createInternalProductionFromUsedExistingPanel_(
    sheet,
    rowNum,
    safeBatch,
    safeColor,
    safeWarehouse,
    effectiveUser
  );

  var market = sheet.getRange(rowNum, COLUMN_MAP.MARKET + 1).getDisplayValue();
  sheet.getRange(rowNum, COLUMN_MAP.REVIEW_GROUP + 1).setValue("STOCK");
  sheet.getRange(rowNum, COLUMN_MAP.SHIP_METHOD + 1).setValue(getUrgentPanelReadyShipMethod_(market));
  setTargetSheetStatus_(sheet, rowNum, "Ready");
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  try {
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("useExistingUrgentPanel Slack sync: " + slackErr);
  }
  try {
    if (typeof notifyUrgentPanelReadyForPalletShipping_ === "function") {
      notifyUrgentPanelReadyForPalletShipping_(sheet, rowNum);
    }
  } catch (shipSlackErr) {
    Logger.log("useExistingUrgentPanel shipping Slack: " + shipSlackErr);
  }
  return "Ready";
}

function updatePartToShipped(rpNum, method, tracking) {
  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";

  var sheet = getTargetSheet_();
  sheet.getRange(rowNum, COLUMN_MAP.SHIP_METHOD + 1).setValue(method || "");
  setTargetSheetStatus_(sheet, rowNum, "Shipped");
  sheet.getRange(rowNum, COLUMN_MAP.TRACKING + 1).setValue(tracking || "");
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  try {
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("updatePartToShipped Slack sync: " + slackErr);
  }
  return "Success";
}

function revertToActive(rpNum) {
  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";

  assertUserCanModifyRp_(rowNum);
  var sheet = getTargetSheet_();
  var row = sheet.getRange(rowNum, 1, rowNum, COLUMN_MAP.COL_Z + 1).getDisplayValues()[0];
  var statusBefore = normalizeCell_(row[COLUMN_MAP.STATUS]);
  var shipMethod = row[COLUMN_MAP.SHIP_METHOD];
  if (isPalletOrContainerShipMethod_(shipMethod)) {
    setTargetSheetStatus_(sheet, rowNum, "Ready", statusBefore);
  } else {
    setTargetSheetStatus_(sheet, rowNum, "Briefed", statusBefore);
  }
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  try {
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("revertToActive Slack sync: " + slackErr);
  }
  return "Reverted";
}

function cancelRp(rpNum) {
  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";

  assertUserCanModifyRp_(rowNum);
  var sheet = getTargetSheet_();
  var statusBefore = normalizeCell_(
    sheet.getRange(rowNum, COLUMN_MAP.STATUS + 1).getDisplayValue()
  );
  setTargetSheetStatus_(sheet, rowNum, "Cancelled", statusBefore);
  invalidatePartsCache_();
  if (statusBefore === "Ready") {
    try {
      if (typeof notifyShippingSlackNoLongerReady_ === "function") {
        notifyShippingSlackNoLongerReady_(sheet, rowNum, "Cancelled");
      }
    } catch (shipSlackErr) {
      Logger.log("cancelRp shipping Slack: " + shipSlackErr);
    }
  }
  return "Cancelled";
}

function normalizeFactoryGroup_(value) {
  var upper = normalizeCell_(value).toUpperCase();
  if (upper === "KAZ" || upper === "VAR") return upper;
  return "";
}

function rowMatchesFactoryGroupForPanelOrder_(reviewGroupCell, factoryGroup) {
  factoryGroup = normalizeCell_(factoryGroup).toUpperCase();
  if (!factoryGroup) return false;
  return hasAnyToken_(reviewGroupCell, [factoryGroup]);
}

function rowMatchesIpFactoryGroupForPanelOrder_(factoryCell, factoryGroup) {
  return rowMatchesFactoryGroupForPanelOrder_(factoryCell, factoryGroup);
}

function isPanelLikeItemTypeForWorkshopNote_(itemType) {
  return !hasAnyToken_(itemType, ["PART", "PARTS", "STOCK", "SPARE"]);
}

function isWorkshopNoteViewerForFactory_(viewerEmail, factoryGroup) {
  var ev = normalizeCell_(viewerEmail).toLowerCase();
  if (factoryGroup === "KAZ") {
    return ev === "stefan@meavo.com" || ev === "kalin@meavo.com";
  }
  if (factoryGroup === "VAR") {
    return ev === "boyan@meavo.com" || ev === "yavor@meavo.com" ||
      ev === "ivan@meavo.com" || ev === "kalin@meavo.com";
  }
  return false;
}

function getWorkshopNoteFlags_(viewerEmail, factoryGroup, itemType) {
  var show = !!factoryGroup &&
    isPanelLikeItemTypeForWorkshopNote_(itemType) &&
    isWorkshopNoteViewerForFactory_(viewerEmail, factoryGroup);
  return {
    showWorkshopNote: show,
    canEditWorkshopNote: show
  };
}

function applyWorkshopNoteToDashboardPart_(part, viewerEmail, recordType) {
  part = part || {};
  var factoryGroup = normalizeFactoryGroup_(part.reviewGroup || part.factory);
  var flags = getWorkshopNoteFlags_(viewerEmail, factoryGroup, part.itemType);
  part.workshopNote = normalizeCell_(part.workshopNote);
  part.showWorkshopNote = flags.showWorkshopNote;
  part.canEditWorkshopNote = flags.canEditWorkshopNote;
  if (recordType) part.recordType = recordType;
  return part;
}

function getWorkshopNoteForIpRowNum_(ipRowNum) {
  if (!ipRowNum || ipRowNum <= 1) return "";
  var ipSheet = getInternalProductionSheet_();
  return normalizeCell_(ipSheet.getRange(ipRowNum, INTERNAL_PRODUCTION_COL.WORKSHOP_NOTE).getDisplayValue());
}

function setWorkshopNoteForIpRowNum_(ipRowNum, note) {
  var ipSheet = getInternalProductionSheet_();
  ipSheet.getRange(ipRowNum, INTERNAL_PRODUCTION_COL.WORKSHOP_NOTE).setValue(note || "");
}

function markSourceRpDoNotProduce_(sourceRpNum) {
  var rpNum = normalizeCell_(sourceRpNum);
  if (!rpNum) return;
  var rpRowNum = findRowByRpNum_(rpNum);
  if (!rpRowNum) return;
  getTargetSheet_().getRange(rpRowNum, COLUMN_MAP.WORKSHOP_NOTE + 1).setValue(RP_DO_NOT_PRODUCE_WORKSHOP_NOTE_);
}

function updateWorkshopNoteFromWeb(recordNum, recordType, note, simulatedEmail) {
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUser = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  var safeNote = normalizeCell_(note);
  var rt = normalizeCell_(recordType).toLowerCase() || "rp";

  if (rt === "ip" || isInternalProductionRecordNum_(recordNum)) {
    var ipRowNum = findRowByIpNum_(recordNum);
    if (!ipRowNum) throw new Error("Record not found.");
    var ipSheet = getInternalProductionSheet_();
    var factory = normalizeFactoryGroup_(ipSheet.getRange(ipRowNum, INTERNAL_PRODUCTION_COL.FACTORY).getDisplayValue());
    var panel = ipSheet.getRange(ipRowNum, INTERNAL_PRODUCTION_COL.PANEL).getDisplayValue();
    if (!isWorkshopNoteViewerForFactory_(effectiveUser, factory)) {
      throw new Error("Access denied.");
    }
    if (!isPanelLikeItemTypeForWorkshopNote_(panel)) {
      throw new Error("Workshop note is not available for this item type.");
    }
    setWorkshopNoteForIpRowNum_(ipRowNum, safeNote);
    invalidatePartsCache_();
    SpreadsheetApp.flush();
    return "Updated";
  }

  var rowNum = findRowByRpNum_(recordNum);
  if (!rowNum) throw new Error("RP not found.");
  var sheet = getTargetSheet_();
  var row = sheet.getRange(rowNum, 1, rowNum, COLUMN_MAP.WORKSHOP_NOTE + 1).getDisplayValues()[0];
  var factory = normalizeFactoryGroup_(row[COLUMN_MAP.REVIEW_GROUP]);
  if (!isWorkshopNoteViewerForFactory_(effectiveUser, factory)) {
    throw new Error("Access denied.");
  }
  if (!isPanelLikeItemTypeForWorkshopNote_(row[COLUMN_MAP.ITEM_TYPE])) {
    throw new Error("Workshop note is not available for this item type.");
  }
  sheet.getRange(rowNum, COLUMN_MAP.WORKSHOP_NOTE + 1).setValue(safeNote);
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  return "Updated";
}

function updateInternalProductionDateFromWeb_(ipNum, newDate, reason) {
  var rowNum = findRowByIpNum_(ipNum);
  if (!rowNum) return "IP not found";

  var sheet = getInternalProductionSheet_();
  var notesCell = sheet.getRange(rowNum, INTERNAL_PRODUCTION_COL.NOTES);
  var currentNotes = normalizeCell_(notesCell.getValue());
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM");
  var delayNote = "[" + timestamp + " Delayed: " + reason + "]";
  var mergedNotes = currentNotes ? currentNotes + " | " + delayNote : delayNote;

  sheet.getRange(rowNum, INTERNAL_PRODUCTION_COL.DEADLINE).setValue(newDate || "");
  sheet.getRange(rowNum, INTERNAL_PRODUCTION_COL.STATUS).setValue("Delayed");
  notesCell.setValue(mergedNotes);
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  return "Updated";
}

function updateDateFromWeb(rpNum, newDate, reason) {
  var currentUser = Session.getActiveUser().getEmail();
  if (!canEditDueDateForViewer_(currentUser, isAdminUser_(currentUser))) {
    throw new Error("You are not allowed to change due dates.");
  }

  if (isInternalProductionRecordNum_(rpNum)) {
    return updateInternalProductionDateFromWeb_(rpNum, newDate, reason);
  }

  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";

  var sheet = getTargetSheet_();
  var statusBefore = normalizeCell_(
    sheet.getRange(rowNum, COLUMN_MAP.STATUS + 1).getDisplayValue()
  );
  var notesCell = sheet.getRange(rowNum, COLUMN_MAP.NOTES + 1);
  var currentNotes = normalizeCell_(notesCell.getValue());
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM");
  var delayNote = "[" + timestamp + " Delayed: " + reason + "]";
  var mergedNotes = currentNotes ? currentNotes + " | " + delayNote : delayNote;

  // Preserves the established behavior of storing the revised date in column C.
  sheet.getRange(rowNum, 3).setValue(newDate || "");
  setTargetSheetStatus_(sheet, rowNum, "Delayed", statusBefore);
  notesCell.setValue(mergedNotes);
  invalidatePartsCache_();
  if (statusBefore === "Ready") {
    try {
      if (typeof notifyShippingSlackNoLongerReady_ === "function") {
        notifyShippingSlackNoLongerReady_(sheet, rowNum, "Delayed");
      }
    } catch (shipSlackErr) {
      Logger.log("updateDateFromWeb shipping Slack: " + shipSlackErr);
    }
  }
  SpreadsheetApp.flush();
  try {
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("updateDateFromWeb Slack sync: " + slackErr);
  }
  return "Updated";
}

function saveInfoOnly(rpNum, method, tracking) {
  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";

  var sheet = getTargetSheet_();
  sheet.getRange(rowNum, COLUMN_MAP.SHIP_METHOD + 1).setValue(method || "");
  sheet.getRange(rowNum, COLUMN_MAP.TRACKING + 1).setValue(tracking || "");
  invalidatePartsCache_();
  return "Saved";
}

/**
 * Anna: Pallet/Container — persist ship method and set status to Ready (warehouse ready / inform logistics).
 */
function annaMarkReadyForLogistics(rpNum, method, simulatedEmail) {
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUser = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  var reviewerConfig = getReviewerDashboardConfig_(effectiveUser);
  if (!reviewerConfig) {
    throw new Error("Access denied.");
  }

  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";

  var sheet = getTargetSheet_();
  // "Информирай логистика" is a pallet-ready action for all item types.
  var safeMethod = "Pallet";
  sheet.getRange(rowNum, COLUMN_MAP.SHIP_METHOD + 1).setValue(safeMethod || "");
  setTargetSheetStatus_(sheet, rowNum, "Ready");
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  try {
    if (typeof clearUrpsPalletReadySentFlagForRp === "function") {
      clearUrpsPalletReadySentFlagForRp(rpNum);
    }
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("annaMarkReadyForLogistics Slack sync: " + slackErr);
  }
  return "Success";
}

/**
 * Anna: from Готови — set status to Briefed so the RP returns to Активни.
 * Only allowed when column X is Ready. Clears column Z ready date.
 */
function annaRevertReadyToActive(rpNum, simulatedEmail) {
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUser = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isAnnaReviewer_(effectiveUser)) {
    throw new Error("Access denied.");
  }

  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "RP not found";

  var sheet = getTargetSheet_();
  var status = normalizeCell_(sheet.getRange(rowNum, COLUMN_MAP.STATUS + 1).getDisplayValue());
  if (status !== "Ready") {
    return "Not ready";
  }

  setTargetSheetStatus_(sheet, rowNum, "Briefed", "Ready");
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  try {
    if (typeof notifyShippingSlackNoLongerReady_ === "function") {
      notifyShippingSlackNoLongerReady_(sheet, rowNum, "Briefed");
    }
  } catch (shipSlackErr) {
    Logger.log("annaRevertReadyToActive shipping Slack: " + shipSlackErr);
  }
  try {
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("annaRevertReadyToActive Slack sync: " + slackErr);
  }
  return "Success";
}

function getTargetSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.TARGET_SHEET);
  if (!sheet) {
    throw new Error('Required sheet "' + CONFIG.TARGET_SHEET + '" was not found.');
  }
  return sheet;
}

function getInternalProductionSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.INTERNAL_PRODUCTION_SHEET);
  if (!sheet) {
    throw new Error('Required sheet "' + CONFIG.INTERNAL_PRODUCTION_SHEET + '" was not found.');
  }
  return sheet;
}

function buildNextIpLabel_(sheet) {
  var values = sheet.getRange("A:A").getDisplayValues();
  var maxIpNumber = 0;
  for (var i = 0; i < values.length; i++) {
    var raw = normalizeCell_(values[i][0]);
    if (!raw) continue;
    var match = raw.match(/IP-(\d+)/i) || raw.match(/^(\d+)$/);
    if (!match) continue;
    var num = Number(match[1]);
    if (!isNaN(num) && num > maxIpNumber) maxIpNumber = num;
  }
  return "IP-" + (maxIpNumber + 1);
}

function deduceFactoryFromBatch_(batch) {
  var batchUpper = normalizeCell_(batch).toUpperCase();
  if (!batchUpper) return "";
  var match = batchUpper.match(/([A-Z]{2})(\d{2,3})/);
  if (!match) return "";
  var code = match[1];
  if (code === "KB") return "KAZ";
  if (code === "VB") return "VAR";
  if (code === "AB") return "AKS";
  return "";
}

function formatInternalProductionUrgency_(urgencyRaw) {
  var normalized = normalizeCell_(urgencyRaw).toLowerCase();
  if (normalized === "urgent") return "Urgent";
  if (normalized === "standard") return "Standard";
  return normalizeCell_(urgencyRaw);
}

/**
 * Used Existing Panel: append one row to Internal Production (Stock Replacement from RP).
 */
function createInternalProductionFromUsedExistingPanel_(sourceSheet, sourceRowNum, batch, color, warehouse, ownerEmail) {
  var ipSheet = getInternalProductionSheet_();
  var sourceRow = sourceSheet.getRange(sourceRowNum, 1, sourceRowNum, COLUMN_MAP.COL_Z + 1).getDisplayValues()[0];
  var ipNum = buildNextIpLabel_(ipSheet);
  var factory = deduceFactoryFromBatch_(batch);
  var sourceRpNum = normalizeCell_(sourceRow[COLUMN_MAP.RP_NUM]);

  var ipEntryDate = new Date();
  var ipDeadline = computeShippingDeadlineFromUrgency_("Standard", ipEntryDate);

  var rowOut = new Array(INTERNAL_PRODUCTION_LAST_COL_);
  rowOut[INTERNAL_PRODUCTION_COL.IP_NUM - 1] = ipNum;
  rowOut[INTERNAL_PRODUCTION_COL.DATE - 1] = ipEntryDate;
  rowOut[INTERNAL_PRODUCTION_COL.DEADLINE - 1] = ipDeadline;
  rowOut[INTERNAL_PRODUCTION_COL.OWNER - 1] = normalizeCell_(ownerEmail);
  rowOut[INTERNAL_PRODUCTION_COL.REASON - 1] = "Stock Replacement (RP)";
  rowOut[INTERNAL_PRODUCTION_COL.URGENCY - 1] = "Standard";
  rowOut[INTERNAL_PRODUCTION_COL.MODEL - 1] = sourceRow[COLUMN_MAP.MODEL] || "";
  rowOut[INTERNAL_PRODUCTION_COL.BATCH - 1] = batch;
  rowOut[INTERNAL_PRODUCTION_COL.COLOUR - 1] = color;
  rowOut[INTERNAL_PRODUCTION_COL.PANEL - 1] = sourceRow[COLUMN_MAP.ITEM_TYPE] || "";
  rowOut[INTERNAL_PRODUCTION_COL.PANEL_CLARIFICATION - 1] = "";
  rowOut[INTERNAL_PRODUCTION_COL.NOTES - 1] = sourceRpNum
    ? "Stock Replacement for " + sourceRpNum
    : "Stock Replacement for RP";
  rowOut[INTERNAL_PRODUCTION_COL.WAREHOUSE - 1] = warehouse;
  rowOut[INTERNAL_PRODUCTION_COL.FACTORY - 1] = factory;
  rowOut[14] = "";
  rowOut[INTERNAL_PRODUCTION_COL.STATUS - 1] = "Briefed";
  rowOut[INTERNAL_PRODUCTION_COL.TRACKING - 1] = "";
  rowOut[INTERNAL_PRODUCTION_COL.PAYER - 1] = "";
  rowOut[INTERNAL_PRODUCTION_COL.SOURCE_RP - 1] = sourceRpNum || "";

  ipSheet.appendRow(rowOut);
  if (sourceRpNum) {
    markSourceRpDoNotProduce_(sourceRpNum);
  }
  try {
    if (typeof notifyNikolayAksNewEntryFromInternalProductionRow_ === "function") {
      notifyNikolayAksNewEntryFromInternalProductionRow_(rowOut);
    }
  } catch (nikolayDmErr) {
    Logger.log("createInternalProductionFromUsedExistingPanel_ Nikolay DM: " + nikolayDmErr);
  }
  return ipNum;
}

function isNikolayDashboardUser_(email) {
  return normalizeCell_(email).toLowerCase() === "nikolay@meavo.com";
}

/**
 * Create one or more Internal Production rows that are NOT tied to an RP.
 * One submitted panel = one IP row.
 *
 * Access is not gated here — the entry point is controlled by which dashboards expose
 * the New IP Entry button (currently only Nikolay's). When new users are added to the
 * button visibility check in index.html, they can submit through this function as-is.
 *
 * Row placement mirrors the RP entry pattern (`findTargetRowInfo_` in LoggerLogic.js):
 *   - Scan from row 2 down for the first row where every column other than A is empty.
 *   - If A on that row is already populated with a valid `IP-NNN`, reuse that label.
 *   - Otherwise mint the next label via `buildNextIpLabel_` (max A + 1).
 *   - If the sheet has no spare empty rows, extend it.
 *
 * Factory (column N) is hardcoded to "AKS" — currently the only factory this entry
 * form serves. Revisit if non-AKS users get the button.
 *
 * Expected form payload:
 *   {
 *     urgency: "Standard" | "Urgent",
 *     reason:  "Stock Replacement" | "Panel with Foil" | "Reversed Hinges" | "Other",
 *     reasonOther: "..."            // required when reason === "Other"
 *     model:   "Soho" | "Workstation" | "Camden 2" | ...   // full booth-model label
 *     batch:   "AB123" | ...
 *     color:   "White Stock" | "RAL 9010" | "Other freeform" | ...
 *     panels:  [{ panel: "Door (D)", clarification: "..." }, ...]
 *   }
 *
 * @returns {{status:"Success", ipNums:string[]}}
 */
function processNewIpEntry(form) {
  var userEmail = normalizeCell_(Session.getActiveUser().getEmail()).toLowerCase();

  var safeForm = form && typeof form === "object" ? form : {};
  var urgency = normalizeIpEntryUrgency_(safeForm.urgency);
  if (!urgency) throw new Error("Спешност е задължителна.");

  var reason = normalizeIpEntryReason_(safeForm.reason, safeForm.reasonOther);
  if (!reason) throw new Error("Причина е задължителна.");

  var modelLabel = normalizeCell_(safeForm.model);
  if (!modelLabel) throw new Error("Модел на кабина е задължителен.");
  var modelAbbrev = typeof mapBoothModelToAbbreviation_ === "function"
    ? mapBoothModelToAbbreviation_(modelLabel)
    : modelLabel;

  var batch = normalizeCell_(safeForm.batch);
  if (!batch) throw new Error("Партида е задължителна.");

  var color = normalizeCell_(safeForm.color);
  if (!color) throw new Error("Цвят е задължителен.");

  var panels = normalizeIpEntryPanels_(safeForm.panels);
  if (!panels.length) throw new Error("Поне един панел е задължителен.");

  var ipSheet = getInternalProductionSheet_();
  var ipEntryDate = new Date();
  var ipDeadline = computeShippingDeadlineFromUrgency_(urgency, ipEntryDate);

  var createdIpNums = [];
  for (var i = 0; i < panels.length; i++) {
    var info = findIpTargetRowInfo_(ipSheet);
    var ipNum = info.existingIp || buildNextIpLabel_(ipSheet);

    var rowOut = new Array(INTERNAL_PRODUCTION_LAST_COL_);
    for (var c = 0; c < rowOut.length; c++) rowOut[c] = "";
    rowOut[INTERNAL_PRODUCTION_COL.IP_NUM - 1] = ipNum;
    rowOut[INTERNAL_PRODUCTION_COL.DATE - 1] = ipEntryDate;
    rowOut[INTERNAL_PRODUCTION_COL.DEADLINE - 1] = ipDeadline;
    rowOut[INTERNAL_PRODUCTION_COL.OWNER - 1] = userEmail;
    rowOut[INTERNAL_PRODUCTION_COL.REASON - 1] = reason;
    rowOut[INTERNAL_PRODUCTION_COL.URGENCY - 1] = urgency;
    rowOut[INTERNAL_PRODUCTION_COL.MODEL - 1] = modelAbbrev;
    rowOut[INTERNAL_PRODUCTION_COL.BATCH - 1] = batch;
    rowOut[INTERNAL_PRODUCTION_COL.COLOUR - 1] = color;
    rowOut[INTERNAL_PRODUCTION_COL.PANEL - 1] = panels[i].panel;
    rowOut[INTERNAL_PRODUCTION_COL.PANEL_CLARIFICATION - 1] = panels[i].clarification;
    rowOut[INTERNAL_PRODUCTION_COL.FACTORY - 1] = "AKS"; // hardcoded — only AKS-facing dashboards expose this form
    rowOut[INTERNAL_PRODUCTION_COL.STATUS - 1] = "Briefed";

    ipSheet.getRange(info.rowNumber, 1, 1, rowOut.length).setValues([rowOut]);
    SpreadsheetApp.flush(); // ensure subsequent findIpTargetRowInfo_ / buildNextIpLabel_ see this row
    createdIpNums.push(ipNum);
  }

  if (typeof invalidatePartsCache_ === "function") invalidatePartsCache_();
  return { status: "Success", ipNums: createdIpNums };
}

function normalizeIpEntryUrgency_(value) {
  var raw = normalizeCell_(value).toLowerCase();
  if (raw === "urgent" || raw === "спешна" || raw === "спешно") return "Urgent";
  if (raw === "standard" || raw === "стандартна" || raw === "стандартно") return "Standard";
  return "";
}

function normalizeIpEntryReason_(reason, reasonOther) {
  var raw = normalizeCell_(reason);
  var lowered = raw.toLowerCase();
  if (lowered === "other") {
    return normalizeCell_(reasonOther);
  }
  // Allowed canonical reasons; anything else is rejected by the form, but be defensive here too.
  var allowed = { "stock replacement": "Stock Replacement", "panel with foil": "Panel with Foil", "reversed hinges": "Reversed Hinges" };
  return allowed[lowered] || "";
}

function normalizeIpEntryPanels_(panels) {
  if (!Array.isArray(panels)) return [];
  var out = [];
  for (var i = 0; i < panels.length; i++) {
    var entry = panels[i] || {};
    var panelName = normalizeCell_(entry.panel);
    if (!panelName) continue;
    out.push({
      panel: panelName,
      clarification: normalizeCell_(entry.clarification)
    });
  }
  return out;
}

/** True iff the row has any non-empty cell in columns B..S (i.e. occupied independently of A). */
function isInternalProductionRowOccupiedExcludingA_(row) {
  if (!row || !row.length) return false;
  for (var i = 1; i < row.length; i++) {
    if (normalizeCell_(row[i])) return true;
  }
  return false;
}

/**
 * Find the first row where every column other than A is empty. If A already holds a
 * valid `IP-NNN`, return it so the caller can reuse the pre-allocated number; otherwise
 * the caller mints a fresh one via `buildNextIpLabel_`. Rows whose A holds garbage
 * (not a valid IP-NNN) are skipped so we never overwrite an unrecognized identifier.
 *
 * Falls back to extending the sheet when no spare row is found.
 * @returns {{rowNumber:number, existingIp:string}}
 */
function findIpTargetRowInfo_(sheet) {
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var scanHeight = Math.max(lastRow - 1, 1);
  var width = INTERNAL_PRODUCTION_LAST_COL_; // last meaningful 1-based column index
  var values = sheet.getRange(2, 1, scanHeight, width).getDisplayValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (isInternalProductionRowOccupiedExcludingA_(row)) continue;

    var existingA = normalizeCell_(row[INTERNAL_PRODUCTION_COL.IP_NUM - 1]);
    if (!existingA) {
      return { rowNumber: i + 2, existingIp: "" };
    }
    var ipMatch = existingA.match(/IP-(\d+)/i) || existingA.match(/^(\d+)$/);
    if (!ipMatch) {
      // Garbage in A — don't overwrite, keep scanning.
      continue;
    }
    return { rowNumber: i + 2, existingIp: "IP-" + Number(ipMatch[1]) };
  }

  // No spare row — extend the sheet and use the first new row.
  var firstNewRow = sheet.getLastRow() + 1;
  sheet.insertRowsAfter(sheet.getLastRow(), 50);
  return { rowNumber: firstNewRow, existingIp: "" };
}

function isStefanDashboardUser_(email) {
  return normalizeCell_(email).toLowerCase() === "stefan@meavo.com";
}

function isInternalProductionWarehouseReviewer_(email) {
  return isNikolayDashboardUser_(email) || isStefanDashboardUser_(email);
}

function matchesNikolayDashboardView_(status, viewType, options) {
  options = options || {};
  var s = normalizeCell_(status);
  if (viewType === "all") {
    if (options.restrictToActiveAndReady) {
      return s !== "Cancelled" && s !== "Shipped" && !isOrderedOnAmazonStatus_(status);
    }
    return true;
  }
  if (viewType === "cancelled") return s === "Cancelled";
  if (viewType === "ready") return s === "Ready";
  return (
    s !== "Shipped" &&
    s !== "Cancelled" &&
    s !== "Ready" &&
    !isOrderedOnAmazonStatus_(status)
  );
}

function isInternalProductionRowPopulated_(row) {
  if (!row || !row.length) return false;
  if (!normalizeCell_(row[INTERNAL_PRODUCTION_COL.IP_NUM - 1])) return false;
  var colsToCheck = [
    INTERNAL_PRODUCTION_COL.DATE,
    INTERNAL_PRODUCTION_COL.DEADLINE,
    INTERNAL_PRODUCTION_COL.OWNER,
    INTERNAL_PRODUCTION_COL.REASON,
    INTERNAL_PRODUCTION_COL.URGENCY,
    INTERNAL_PRODUCTION_COL.MODEL,
    INTERNAL_PRODUCTION_COL.BATCH,
    INTERNAL_PRODUCTION_COL.COLOUR,
    INTERNAL_PRODUCTION_COL.PANEL,
    INTERNAL_PRODUCTION_COL.PANEL_CLARIFICATION,
    INTERNAL_PRODUCTION_COL.NOTES,
    INTERNAL_PRODUCTION_COL.WAREHOUSE,
    INTERNAL_PRODUCTION_COL.FACTORY,
    INTERNAL_PRODUCTION_COL.STATUS,
    INTERNAL_PRODUCTION_COL.TRACKING,
    INTERNAL_PRODUCTION_COL.PAYER,
    INTERNAL_PRODUCTION_COL.SOURCE_RP,
    INTERNAL_PRODUCTION_COL.WORKSHOP_NOTE,
    INTERNAL_PRODUCTION_COL.ORDER_SENT
  ];
  for (var i = 0; i < colsToCheck.length; i++) {
    if (normalizeCell_(row[colsToCheck[i] - 1])) return true;
  }
  return false;
}

function mapInternalProductionRowToDashboard_(row, options) {
  options = options || {};
  var panel = normalizeCell_(row[INTERNAL_PRODUCTION_COL.PANEL - 1]);
  var items = [];
  if (panel) {
    items.push({
      itemType: panel,
      displayText: panel,
      code: "",
      description: panel,
      qty: ""
    });
  }
  return applyWorkshopNoteToDashboardPart_({
    recordType: "ip",
    rpNum: normalizeCell_(row[INTERNAL_PRODUCTION_COL.IP_NUM - 1]),
    due: row[INTERNAL_PRODUCTION_COL.DEADLINE - 1] || "",
    market: "",
    user: normalizeCell_(row[INTERNAL_PRODUCTION_COL.OWNER - 1]),
    issue: normalizeCell_(row[INTERNAL_PRODUCTION_COL.REASON - 1]),
    priority: formatInternalProductionUrgency_(row[INTERNAL_PRODUCTION_COL.URGENCY - 1]),
    model: row[INTERNAL_PRODUCTION_COL.MODEL - 1] || "",
    boothId: "",
    color: row[INTERNAL_PRODUCTION_COL.COLOUR - 1] || "",
    itemType: panel,
    batch: normalizeCell_(row[INTERNAL_PRODUCTION_COL.BATCH - 1]),
    warehouse: normalizeCell_(row[INTERNAL_PRODUCTION_COL.WAREHOUSE - 1]),
    factory: normalizeCell_(row[INTERNAL_PRODUCTION_COL.FACTORY - 1]),
    reviewGroup: normalizeCell_(row[INTERNAL_PRODUCTION_COL.FACTORY - 1]),
    sourceRp: normalizeCell_(row[INTERNAL_PRODUCTION_COL.SOURCE_RP - 1]),
    clarification: row[INTERNAL_PRODUCTION_COL.PANEL_CLARIFICATION - 1] || "",
    note: row[INTERNAL_PRODUCTION_COL.NOTES - 1] || "",
    workshopNote: options.workshopNoteValue != null
      ? options.workshopNoteValue
      : normalizeCell_(row[INTERNAL_PRODUCTION_COL.WORKSHOP_NOTE - 1]),
    client: "",
    address: "",
    recipient: "",
    phone: "",
    email: "",
    method: "",
    status: normalizeCell_(row[INTERNAL_PRODUCTION_COL.STATUS - 1]),
    tracking: row[INTERNAL_PRODUCTION_COL.TRACKING - 1] || "",
    canEditDueDate: !!options.canEditDueDate,
    canEditRp: false,
    editRpDisabledReason: "",
    items: items
  }, options.viewerEmail || "", "ip");
}

function getInternalProductionDataForFactory_(viewType, factoryTokens, options) {
  options = options || {};
  var sheet = getInternalProductionSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var width = INTERNAL_PRODUCTION_LAST_COL_;
  var data = sheet.getRange(2, 1, lastRow, width).getDisplayValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!isInternalProductionRowPopulated_(row)) continue;
    if (!hasAnyToken_(row[INTERNAL_PRODUCTION_COL.FACTORY - 1], factoryTokens)) continue;
    if (!matchesNikolayDashboardView_(row[INTERNAL_PRODUCTION_COL.STATUS - 1], viewType, options)) continue;
    out.push(mapInternalProductionRowToDashboard_(row, {
      canEditDueDate: !!options.canEditDueDate,
      viewerEmail: options.viewerEmail || "",
      ipRowNum: i + 2
    }));
  }
  return out;
}

function getInternalProductionDataForNikolay_(viewType) {
  return getInternalProductionDataForFactory_(viewType, ["AKS"], {
    canEditDueDate: true,
    restrictToActiveAndReady: viewType === "all"
  });
}

function getInternalProductionDataForStefan_(viewType, viewerEmail) {
  return getInternalProductionDataForFactory_(viewType, ["KAZ"], {
    canEditDueDate: true,
    viewerEmail: viewerEmail || ""
  });
}

function sortNikolayDashboardEntries_(a, b) {
  var aUrgent = normalizeCell_(a.priority).toLowerCase() === "urgent";
  var bUrgent = normalizeCell_(b.priority).toLowerCase() === "urgent";
  if (aUrgent && !bUrgent) return -1;
  if (!aUrgent && bUrgent) return 1;
  var dueCmp = compareDueDates_(a.due, b.due);
  if (dueCmp) return dueCmp;
  var aNum = Number(String(a.rpNum || "").replace(/\D/g, "")) || 0;
  var bNum = Number(String(b.rpNum || "").replace(/\D/g, "")) || 0;
  return bNum - aNum;
}

/**
 * Nikolay dashboard: AKS panels from main sheet (RP) + populated AKS rows from Internal Production (IP).
 */
function findRowByIpNum_(ipNum) {
  var sheet = getInternalProductionSheet_();
  var target = normalizeCell_(ipNum).toUpperCase();
  if (!target) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var values = sheet.getRange(2, INTERNAL_PRODUCTION_COL.IP_NUM, lastRow, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (normalizeCell_(values[i][0]).toUpperCase() === target) {
      return i + 2;
    }
  }
  return 0;
}

/**
 * Nikolay: mark Internal Production row Ready (warehouse / Готово за склад).
 */
function nikolayMarkIpReadyForWarehouse(ipNum, simulatedEmail) {
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUser = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isInternalProductionWarehouseReviewer_(effectiveUser)) {
    throw new Error("Access denied.");
  }

  var rowNum = findRowByIpNum_(ipNum);
  if (!rowNum) return "IP not found";

  var sheet = getInternalProductionSheet_();
  var factory = normalizeCell_(sheet.getRange(rowNum, INTERNAL_PRODUCTION_COL.FACTORY).getDisplayValue());
  if (isNikolayDashboardUser_(effectiveUser) && !hasAnyToken_(factory, ["AKS"])) {
    throw new Error("Access denied.");
  }
  if (isStefanDashboardUser_(effectiveUser) && !hasAnyToken_(factory, ["KAZ"])) {
    throw new Error("Access denied.");
  }

  var status = normalizeCell_(sheet.getRange(rowNum, INTERNAL_PRODUCTION_COL.STATUS).getDisplayValue());
  if (status === "Ready") return "Already ready";
  if (status === "Cancelled" || status === "Shipped") {
    throw new Error("Cannot mark ready from status: " + status);
  }

  sheet.getRange(rowNum, INTERNAL_PRODUCTION_COL.STATUS).setValue("Ready");
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  return "Success";
}

/**
 * Todor IP view: mark Internal Production row Delivered at Topoli warehouse.
 */
function todorMarkIpDeliveredAtTopoli(ipNum, simulatedEmail) {
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUser = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isTodorDashboardViewerEmail_(effectiveUser)) {
    throw new Error("Access denied.");
  }

  var rowNum = findRowByIpNum_(ipNum);
  if (!rowNum) return "IP not found";

  var sheet = getInternalProductionSheet_();
  var warehouse = normalizeCell_(sheet.getRange(rowNum, INTERNAL_PRODUCTION_COL.WAREHOUSE).getDisplayValue());
  if (!isTopoliWarehouseName_(warehouse)) {
    throw new Error("IP is not assigned to Topoli warehouse.");
  }

  var status = normalizeCell_(sheet.getRange(rowNum, INTERNAL_PRODUCTION_COL.STATUS).getDisplayValue());
  if (status.toLowerCase() === "delivered") return "Already delivered";
  if (status === "Cancelled") {
    throw new Error("Cannot mark delivered from status: " + status);
  }

  sheet.getRange(rowNum, INTERNAL_PRODUCTION_COL.STATUS).setValue("Delivered");
  invalidatePartsCache_();
  SpreadsheetApp.flush();
  return "Success";
}

function isKalinAllRpsDashboardUser_(email) {
  return normalizeCell_(email).toLowerCase() === "kalin@meavo.com";
}

/**
 * All RPs on the main sheet (no owner filter), for Kalin's All RPs dashboard.
 */
function getPartsDataAllOwners_(viewType, viewerEmail) {
  var safeViewType = viewType || "active";
  var data = getCachedSheetDisplayValues_();
  if (data.length <= 1) return [];
  var colBRawDates = getCachedColumnBRawDates_();

  return data.slice(1)
    .map(function(row, idx) {
      return { row: row, idx: idx };
    })
    .filter(function(entry) {
      var row = entry.row;
      var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
      if (!rpNum) return false;
      var reviewGroup = normalizeCell_(row[COLUMN_MAP.REVIEW_GROUP]).toUpperCase();
      if (reviewGroup !== "AKS" && reviewGroup !== "VAR" && reviewGroup !== "KAZ") return false;
      var status = normalizeCell_(row[COLUMN_MAP.STATUS]);
      if (safeViewType === "all") {
        if (status === "Cancelled") return false;
        if (isOrderedOnAmazonStatus_(status)) return false;
        return true;
      }
      if (safeViewType === "archive") return status === "Shipped";
      if (safeViewType === "cancelled") return status === "Cancelled";
      return status !== "Shipped" && status !== "Cancelled" && !isOrderedOnAmazonStatus_(status);
    })
    .map(function(entry) {
      var row = entry.row;
      var editInfo = getRpEditWindowInfo_(
        colBRawDates[entry.idx] || null,
        row[COLUMN_MAP.USER_ID],
        viewerEmail,
        row[COLUMN_MAP.STATUS]
      );
      return applyWorkshopNoteToDashboardPart_({
        rpNum: row[COLUMN_MAP.RP_NUM],
        due: row[COLUMN_MAP.DUE_DATE],
        market: row[COLUMN_MAP.MARKET],
        user: row[COLUMN_MAP.USER_ID],
        issue: row[COLUMN_MAP.ISSUE_TYPE],
        priority: row[COLUMN_MAP.URGENCY],
        model: row[COLUMN_MAP.MODEL],
        boothId: row[COLUMN_MAP.BOOTH_ID],
        color: row[COLUMN_MAP.COLOR],
        itemType: row[COLUMN_MAP.ITEM_TYPE],
        qty: row[COLUMN_MAP.QUANTITY],
        partRpCode: row[COLUMN_MAP.PART_RP_CODE],
        desc: row[COLUMN_MAP.PART_DESC],
        clarification: row[COLUMN_MAP.CLARIFICATIONS],
        note: row[COLUMN_MAP.NOTES],
        client: row[COLUMN_MAP.CLIENT],
        address: row[COLUMN_MAP.ADDRESS],
        recipient: row[COLUMN_MAP.RECIPIENT],
        phone: row[COLUMN_MAP.PHONE],
        email: row[COLUMN_MAP.EMAIL],
        method: row[COLUMN_MAP.SHIP_METHOD],
        status: row[COLUMN_MAP.STATUS],
        tracking: row[COLUMN_MAP.TRACKING],
        reviewGroup: row[COLUMN_MAP.REVIEW_GROUP],
        workshopNote: row[COLUMN_MAP.WORKSHOP_NOTE],
        canEditDueDate: canEditDueDateForViewer_(viewerEmail, false),
        canEditRp: editInfo.canEdit,
        editRpDisabledReason: editInfo.reason,
        items: buildItemsForWeb_(row),
        recordType: "rp"
      }, viewerEmail, "rp");
    })
    .sort(function(a, b) {
      return Number(b.rpNum) - Number(a.rpNum);
    });
}

function getInternalProductionDataForKalin_(viewType, viewerEmail) {
  var factories = ["AKS", "VAR", "KAZ"];
  var out = [];
  for (var i = 0; i < factories.length; i++) {
    out = out.concat(getInternalProductionDataForFactory_(viewType, [factories[i]], {
      canEditDueDate: canEditDueDateForViewer_(viewerEmail, false),
      viewerEmail: viewerEmail || ""
    }));
  }
  return out;
}

function getKalinAllRpsDashboardData(viewType, simulatedEmail) {
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUser = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isKalinAllRpsDashboardUser_(effectiveUser)) {
    throw new Error("Access denied for Kalin all RPs dashboard.");
  }

  var safeView = viewType || "active";
  var rpParts = getPartsDataAllOwners_(safeView, effectiveUser);
  var ipEntries = getInternalProductionDataForKalin_(safeView, effectiveUser);
  var combined = rpParts.concat(ipEntries);
  combined.sort(sortNikolayDashboardEntries_);
  return combined;
}

function getStefanDashboardData(viewType, simulatedEmail) {
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUser = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isStefanDashboardUser_(effectiveUser)) {
    throw new Error("Access denied for Stefan dashboard.");
  }

  var safeView = viewType || "active";
  var rpParts = getPartsData(safeView, simulatedEmail, "", "", null);
  for (var i = 0; i < rpParts.length; i++) {
    rpParts[i].recordType = "rp";
  }
  var ipEntries = getInternalProductionDataForStefan_(safeView, effectiveUser);
  var combined = rpParts.concat(ipEntries);
  combined.sort(sortNikolayDashboardEntries_);
  return combined;
}

function getNikolayDashboardData(viewType, simulatedEmail) {
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUser = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isNikolayDashboardUser_(effectiveUser)) {
    throw new Error("Access denied for Nikolay dashboard.");
  }

  var safeView = viewType || "active";
  var rpParts = getPartsData(safeView, simulatedEmail, "", "", null);
  for (var i = 0; i < rpParts.length; i++) {
    rpParts[i].recordType = "rp";
  }
  var ipEntries = getInternalProductionDataForNikolay_(safeView);
  var combined = rpParts.concat(ipEntries);
  combined.sort(sortNikolayDashboardEntries_);
  return combined;
}

/**
 * Short-lived shared cache for full-sheet reads.
 *
 * Background: every dashboard tab polls `getPartsData` (and friends) once a
 * minute. Without caching, each concurrent user triggers an independent full
 * sheet read (~5–7s, two `getDataRange()` calls). Caching the read for a few
 * seconds collapses concurrent polls into a single sheet hit and is shared
 * across users because `CacheService.getScriptCache()` is script-wide.
 *
 * The cache is invalidated on every write so users always see fresh data
 * immediately after their own actions. The TTL is a worst-case lag bound for
 * external edits to the spreadsheet.
 */
var PARTS_CACHE_TTL_SECONDS_ = 30;
var PARTS_CACHE_PREFIX_ = "partsSheetCache_v1";
var PARTS_CACHE_META_KEY_ = PARTS_CACHE_PREFIX_ + "_meta";
var PARTS_CACHE_COL_B_KEY_ = PARTS_CACHE_PREFIX_ + "_colB";
// Stay well under the 100KB-per-entry CacheService limit.
var PARTS_CACHE_CHUNK_SIZE_ = 80000;

function invalidatePartsCache_() {
  try {
    var cache = CacheService.getScriptCache();
    var meta = cache.get(PARTS_CACHE_META_KEY_);
    var keys = [PARTS_CACHE_META_KEY_, PARTS_CACHE_COL_B_KEY_];
    if (meta) {
      var count = Number(meta) || 0;
      for (var i = 0; i < count; i++) {
        keys.push(PARTS_CACHE_PREFIX_ + "_data_" + i);
      }
    }
    cache.removeAll(keys);
  } catch (e) {
    // Cache failures must never block writes.
  }
}

function getCachedSheetDisplayValues_() {
  var cache = null;
  try {
    cache = CacheService.getScriptCache();
    var meta = cache.get(PARTS_CACHE_META_KEY_);
    if (meta) {
      var count = Number(meta);
      if (count > 0) {
        var keys = [];
        for (var i = 0; i < count; i++) keys.push(PARTS_CACHE_PREFIX_ + "_data_" + i);
        var got = cache.getAll(keys);
        var str = "";
        var complete = true;
        for (var j = 0; j < count; j++) {
          var part = got[PARTS_CACHE_PREFIX_ + "_data_" + j];
          if (part == null) { complete = false; break; }
          str += part;
        }
        if (complete) {
          try {
            var parsed = JSON.parse(str);
            if (Array.isArray(parsed)) return parsed;
          } catch (parseErr) {
            // Fall through and re-read from the sheet.
          }
        }
      }
    }
  } catch (cacheReadErr) {
    // Fall through and re-read from the sheet.
  }

  var sheet = getTargetSheet_();
  var values = sheet.getDataRange().getDisplayValues();

  if (cache) {
    try {
      var json = JSON.stringify(values);
      var toPut = {};
      var chunkCount = Math.max(1, Math.ceil(json.length / PARTS_CACHE_CHUNK_SIZE_));
      for (var k = 0; k < chunkCount; k++) {
        toPut[PARTS_CACHE_PREFIX_ + "_data_" + k] = json.substr(
          k * PARTS_CACHE_CHUNK_SIZE_,
          PARTS_CACHE_CHUNK_SIZE_
        );
      }
      toPut[PARTS_CACHE_META_KEY_] = String(chunkCount);
      cache.putAll(toPut, PARTS_CACHE_TTL_SECONDS_);
    } catch (cacheWriteErr) {
      // Best-effort caching only.
    }
  }

  return values;
}

/**
 * Returns column B (entry timestamp) as raw Date objects, indexed by data row
 * (0 = first data row). Cached for the same window as the display values.
 */
function getCachedColumnBRawDates_() {
  var cache = null;
  try {
    cache = CacheService.getScriptCache();
    var raw = cache.get(PARTS_CACHE_COL_B_KEY_);
    if (raw) {
      try {
        var parsedIso = JSON.parse(raw);
        if (Array.isArray(parsedIso)) {
          return parsedIso.map(function(iso) {
            if (!iso) return null;
            var d = new Date(iso);
            return isNaN(d.getTime()) ? null : d;
          });
        }
      } catch (parseErr) {
        // Fall through and re-read.
      }
    }
  } catch (cacheReadErr) {
    // Fall through and re-read.
  }

  var sheet = getTargetSheet_();
  var lastRow = sheet.getLastRow();
  var dates = [];
  if (lastRow >= 2) {
    var colB = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < colB.length; i++) {
      var v = colB[i][0];
      dates.push(v instanceof Date ? v : null);
    }
  }

  if (cache) {
    try {
      var serial = dates.map(function(d) { return d ? d.toISOString() : null; });
      cache.put(PARTS_CACHE_COL_B_KEY_, JSON.stringify(serial), PARTS_CACHE_TTL_SECONDS_);
    } catch (cacheWriteErr) {
      // Best-effort caching only.
    }
  }

  return dates;
}

function findRowByRpNum_(rpNum) {
  var sheet = getTargetSheet_();
  if (!sheet) return 0;

  var target = normalizeRpKeyForLookup_(rpNum).toUpperCase();
  if (!target) return 0;

  var values = sheet.getRange("A:A").getDisplayValues();
  for (var i = 1; i < values.length; i++) {
    var cellKey = normalizeRpKeyForLookup_(values[i][0]).toUpperCase();
    if (cellKey === target) {
      return i + 1;
    }
  }
  return 0;
}

function getRpDisplayRowByRpNum_(rpNum) {
  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return null;
  var sheet = getTargetSheet_();
  var width = Math.max(sheet.getLastColumn(), COLUMN_MAP.WORKSHOP_NOTE + 1);
  return sheet.getRange(rowNum, 1, rowNum, width).getDisplayValues()[0];
}

function coerceStefanPanelExportSelections_(selections) {
  if (!selections) return [];
  if (Object.prototype.toString.call(selections) === "[object Array]") return selections;
  if (typeof selections === "object") return [selections];
  return [];
}

function isPartsSpecifyHintText_(text) {
  return /^PARTS\s*\(\s*specify\b/i.test(normalizeCell_(text));
}

function buildItemsForWeb_(row) {
  var quantities = splitPipeValue_(row[COLUMN_MAP.QUANTITY]);
  var codes = splitPipeValue_(row[COLUMN_MAP.PART_RP_CODE]);
  var descriptions = splitPipeValue_(row[COLUMN_MAP.PART_DESC]);
  var itemTypes = splitPipeValue_(row[COLUMN_MAP.ITEM_TYPE]);
  var maxLength = Math.max(quantities.length, codes.length, descriptions.length, itemTypes.length, 1);
  var items = [];

  for (var i = 0; i < maxLength; i++) {
    var qty = quantities[i] || "";
    var code = codes[i] || "";
    var description = descriptions[i] || "";
    var itemType = itemTypes[i] || row[COLUMN_MAP.ITEM_TYPE] || "";

    if (!qty && !code && !description && !itemType) continue;

    items.push({
      qty: qty,
      code: code,
      description: description,
      itemType: itemType,
      displayText: buildItemDisplayText_(qty, description, code, itemType)
    });
  }

  var hasNonHintItems = items.some(function(item) {
    return !isPartsSpecifyHintText_(item.displayText) &&
      !isPartsSpecifyHintText_(item.description) &&
      !isPartsSpecifyHintText_(item.itemType);
  });
  if (hasNonHintItems) {
    items = items.filter(function(item) {
      return !isPartsSpecifyHintText_(item.displayText) &&
        !isPartsSpecifyHintText_(item.description) &&
        !isPartsSpecifyHintText_(item.itemType);
    });
  }

  return items;
}

function buildItemDisplayText_(qty, description, code, itemType) {
  if (!qty && !code && !description && itemType) {
    return itemType;
  }
  var qtyText = "";
  if (qty) {
    qtyText = qty + "x ";
  } else if (itemType) {
    // Fallback for old rows where L is blank: surface K value in item list.
    qtyText = itemType + " ";
  }
  var codeText = code ? " [" + code + "]" : "";
  return qtyText + (description || itemType || "Unknown item") + codeText;
}

function splitPipeValue_(value) {
  var normalized = normalizeCell_(value);
  if (!normalized) return [];
  var parts = normalized.indexOf("\n") !== -1 ? normalized.split(/\r?\n/) : normalized.split("|");
  return parts.map(function(part) {
    return cleanIndexedValue_(part);
  }).filter(function(part) {
    return part !== "";
  });
}

function normalizeCell_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** Column X status: Amazon-ordered replacement (case-insensitive). */
function isOrderedOnAmazonStatus_(status) {
  return normalizeCell_(status).toLowerCase() === "ordered on amazon";
}

function cleanIndexedValue_(value) {
  var normalized = normalizeCell_(value);
  if (!normalized) return "";
  return normalized.replace(/^\d+\)\s*/, "").trim();
}

/** Admin emails — full RP-app rights and the unrestricted admin dashboard view. */
var ADMIN_EMAILS_ = {
  "boyan@meavo.com": true,
  "todor@meavo.com": true
};

function isAdminUser_(userEmail) {
  return ADMIN_EMAILS_[normalizeCell_(userEmail).toLowerCase()] === true;
}

function getReviewerDashboardConfig_(userEmail) {
  var key = normalizeCell_(userEmail).toLowerCase();
  return REVIEWER_DASHBOARD_CONFIGS_.hasOwnProperty(key) ? REVIEWER_DASHBOARD_CONFIGS_[key] : null;
}

function isAnnaReviewer_(userEmail) {
  return !!getReviewerDashboardConfig_(userEmail);
}

function canEditDueDateForViewer_(viewerEmail, isAdmin) {
  if (isAdmin) return true;
  if (isNikolayDashboardUser_(viewerEmail)) return true;
  return isAnnaReviewer_(viewerEmail);
}

function isInternalProductionRecordNum_(recordNum) {
  return /^IP-/i.test(normalizeCell_(recordNum));
}

function isReviewerDashboardEligibleRow_(itemType, reviewGroup, reviewerDashboardConfig) {
  if (!reviewerDashboardConfig) return false;
  var hasValidReviewGroup = hasAnyToken_(reviewGroup, reviewerDashboardConfig.allowedReviewGroups || []);
  if (!hasValidReviewGroup) return false;
  if (hasAnyToken_(itemType, reviewerDashboardConfig.excludedItemTypes || [])) return false;
  if (reviewerDashboardConfig.allowAllItemTypes) return true;
  var hasValidType = hasAnyToken_(itemType, reviewerDashboardConfig.allowedItemTypes || []);
  return hasValidType && hasValidReviewGroup;
}

function hasAnyToken_(value, tokens) {
  var normalized = normalizeCell_(value).toUpperCase();
  if (!normalized) return false;
  var parts = normalized.split("|").map(function(part) {
    return normalizeCell_(part).toUpperCase();
  });
  return tokens.some(function(token) {
    return parts.indexOf(token) !== -1;
  });
}

function compareDueDates_(aDue, bDue) {
  var aDate = parseDueDate_(aDue);
  var bDate = parseDueDate_(bDue);
  if (aDate && bDate) return aDate - bDate;
  if (aDate && !bDate) return -1;
  if (!aDate && bDate) return 1;
  return 0;
}

function parseDueDate_(value) {
  var raw = normalizeCell_(value);
  if (!raw) return null;

  var isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  var slashMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (slashMatch) {
    var day = Number(slashMatch[1]);
    var month = Number(slashMatch[2]) - 1;
    var year = slashMatch[3] ? Number(slashMatch[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  var parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function buildQtyAndPanelText_(qty, itemType) {
  var qtyText = normalizeCell_(qty);
  var panelText = normalizeCell_(itemType);
  if (!qtyText && !panelText) return "";
  if (!qtyText) return panelText;
  if (!panelText) return qtyText;
  return qtyText + " x " + panelText;
}

function matchesActiveUrgentPanelsStatus_(status, panelView) {
  var s = normalizeCell_(status);
  if (panelView === "all") return s !== "Cancelled";
  if (panelView === "inproduction") return s === "In Production" || s === "Briefed";
  if (panelView === "ready") return s === "Ready";
  if (panelView === "shipped") return s === "Shipped";
  // default: Unbriefed
  return s !== "In Production" && s !== "Briefed" && s !== "Ready" && s !== "Shipped" && s !== "Cancelled";
}

function getEffectiveUserEmail_(currentUserEmail, simulatedEmail, isAdmin) {
  var normalizedCurrent = normalizeCell_(currentUserEmail).toLowerCase();
  var normalizedSimulated = normalizeCell_(simulatedEmail).toLowerCase();
  if (!isAdmin || !normalizedSimulated) return normalizedCurrent;

  // Restrict simulation to your org email domain only.
  if (!/@meavo\.com$/.test(normalizedSimulated)) {
    return normalizedCurrent;
  }

  return normalizedSimulated;
}

function assertUserCanModifyRp_(rowNum) {
  var currentUser = normalizeCell_(Session.getActiveUser().getEmail()).toLowerCase();
  if (isAdminUser_(currentUser) || isAnnaReviewer_(currentUser)) return;

  var sheet = getTargetSheet_();
  var owner = normalizeCell_(sheet.getRange(rowNum, COLUMN_MAP.USER_ID + 1).getDisplayValue()).toLowerCase();
  if (owner !== currentUser) {
    throw new Error("You are not allowed to modify this RP.");
  }
}

var STEFAN_PANEL_EXPORT_HEADERS_ = [
  "Номер",
  "Проблем / Щета",
  "Платец",
  "ID",
  "Модел",
  "Цвят",
  "Бележка Търговци",
  "Описание",
  "Бележка цех",
  "Срок",
  "Държава"
];

var STEFAN_PANEL_EXPORT_COL_WIDTHS_ = [58, 132, 56, 112, 84, 92, 132, 168, 118, 72, 104];

/** DocumentApp table column widths in points (must fit landscape A4 content area). */
var STEFAN_PANEL_EXPORT_DOC_COL_WIDTHS_PT_ = [
  40,  // Номер
  72,  // Проблем / Щета
  48,  // Платец
  70,  // ID
  52,  // Модел
  62,  // Цвят
  88,  // Бележка Търговци
  72,  // Описание
  148, // Бележка цех
  62,  // Срок (dd/MM/yyyy)
  58   // Държава
];

var STEFAN_PANEL_EXPORT_STYLE_ = {
  headerBg: "#d9d9d9",
  metaBg: "#ffffff",
  dataBg: "#ffffff",
  borderColor: "#000000",
  fontFamily: "Arial",
  metaFontSize: 9,
  headerFontSize: 8,
  dataFontSize: 8
};

var STEFAN_PANEL_EXPORT_DOC_PAGE_ = {
  widthPt: 842,
  heightPt: 595,
  marginPt: 18
};

function getStefanPanelExportDocContentWidthPt_() {
  var page = STEFAN_PANEL_EXPORT_DOC_PAGE_;
  return page.widthPt - page.marginPt * 2;
}

function sumStefanPanelExportDocColWidthsPt_(widths) {
  var total = 0;
  for (var i = 0; i < widths.length; i++) total += widths[i];
  return total;
}

function isStefanActivePanelExportEntry_(entry) {
  if (!entry) return false;
  if (entry.recordType === "ip") return true;
  return isPanelLikeItemTypeForWorkshopNote_(entry.itemType);
}

function getRpIssueAndPayerForExportByRpNum_(rpNum) {
  var rpKey = normalizeRpKeyForLookup_(rpNum);
  if (!rpKey) return { issue: "", payer: "" };

  var data = getCachedSheetDisplayValues_();
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (normalizeRpKeyForLookup_(row[COLUMN_MAP.RP_NUM]) !== rpKey) continue;
    return {
      issue: getRpSheetCellDisplay_(row, COLUMN_MAP.ISSUE_TYPE, rpNum),
      payer: getRpSheetCellDisplay_(row, COLUMN_MAP.PAYER, rpNum)
    };
  }

  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return { issue: "", payer: "" };
  var sheet = getTargetSheet_();
  return {
    issue: normalizeCell_(sheet.getRange(rowNum, COLUMN_MAP.ISSUE_TYPE + 1).getDisplayValue()),
    payer: normalizeCell_(sheet.getRange(rowNum, COLUMN_MAP.PAYER + 1).getDisplayValue())
  };
}

function getRpIssuePayerMapForExport_(rpNums) {
  var needed = {};
  for (var i = 0; i < rpNums.length; i++) {
    var key = normalizeRpKeyForLookup_(rpNums[i]);
    if (key) needed[key] = true;
  }
  var map = {};
  if (!Object.keys(needed).length) return map;
  var data = getCachedSheetDisplayValues_();
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
    var rpKey = normalizeRpKeyForLookup_(rpNum);
    if (!rpKey || !needed[rpKey]) continue;
    map[rpKey] = {
      issue: getRpSheetCellDisplay_(row, COLUMN_MAP.ISSUE_TYPE, rpNum),
      payer: getRpSheetCellDisplay_(row, COLUMN_MAP.PAYER, rpNum)
    };
  }
  return map;
}

function getRpSheetCellDisplay_(row, colIndex, rpNum) {
  if (row && row.length > colIndex) {
    return normalizeCell_(row[colIndex]);
  }
  if (!rpNum) return "";
  var rowNum = findRowByRpNum_(rpNum);
  if (!rowNum) return "";
  return normalizeCell_(getTargetSheet_().getRange(rowNum, colIndex + 1).getDisplayValue());
}

function mapRpSheetRowToStefanExportEntry_(row, effectiveUser) {
  var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
  return applyWorkshopNoteToDashboardPart_({
    recordType: "rp",
    rpNum: rpNum,
    due: row[COLUMN_MAP.DUE_DATE],
    market: row[COLUMN_MAP.MARKET],
    user: row[COLUMN_MAP.USER_ID],
    issue: row[COLUMN_MAP.ISSUE_TYPE],
    priority: row[COLUMN_MAP.URGENCY],
    model: row[COLUMN_MAP.MODEL],
    boothId: row[COLUMN_MAP.BOOTH_ID],
    color: row[COLUMN_MAP.COLOR],
    itemType: row[COLUMN_MAP.ITEM_TYPE],
    desc: row[COLUMN_MAP.PART_DESC],
    clarification: row[COLUMN_MAP.CLARIFICATIONS],
    workshopNote: getRpSheetCellDisplay_(row, COLUMN_MAP.WORKSHOP_NOTE, rpNum),
    reviewGroup: row[COLUMN_MAP.REVIEW_GROUP],
    status: row[COLUMN_MAP.STATUS],
    items: buildItemsForWeb_(row)
  }, effectiveUser, "rp");
}

function resolveStefanPanelExportEntryBySelection_(simulatedEmail, recordNum, recordType) {
  var effectiveUser = assertStefanDashboardAccess_(simulatedEmail);
  var rt = normalizeCell_(recordType).toLowerCase() || "rp";
  var num = normalizeCell_(recordNum);
  if (!num) return null;

  if (rt === "ip" || isInternalProductionRecordNum_(num)) {
    var ipRowNum = findRowByIpNum_(num);
    if (!ipRowNum) return null;
    var ipSheet = getInternalProductionSheet_();
    var displayRow = ipSheet.getRange(ipRowNum, 1, ipRowNum, INTERNAL_PRODUCTION_LAST_COL_).getDisplayValues()[0];
    if (!isInternalProductionRowPopulated_(displayRow)) return null;
    if (!hasAnyToken_(displayRow[INTERNAL_PRODUCTION_COL.FACTORY - 1], ["KAZ"])) return null;
    if (!isPanelLikeItemTypeForWorkshopNote_(displayRow[INTERNAL_PRODUCTION_COL.PANEL - 1])) return null;
    return mapInternalProductionRowToDashboard_(displayRow, {
      viewerEmail: effectiveUser,
      ipRowNum: ipRowNum
    });
  }

  var target = normalizeRpKeyForLookup_(num).toUpperCase();
  if (!target) return null;

  var data = getCachedSheetDisplayValues_();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (normalizeRpKeyForLookup_(row[COLUMN_MAP.RP_NUM]).toUpperCase() !== target) continue;
    if (!hasAnyToken_(row[COLUMN_MAP.REVIEW_GROUP], ["KAZ"])) continue;
    if (!isPanelLikeItemTypeForWorkshopNote_(row[COLUMN_MAP.ITEM_TYPE])) continue;
    return mapRpSheetRowToStefanExportEntry_(row, effectiveUser);
  }

  var sheetRow = getRpDisplayRowByRpNum_(num);
  if (!sheetRow) return null;
  if (!hasAnyToken_(sheetRow[COLUMN_MAP.REVIEW_GROUP], ["KAZ"])) return null;
  if (!isPanelLikeItemTypeForWorkshopNote_(sheetRow[COLUMN_MAP.ITEM_TYPE])) return null;
  return mapRpSheetRowToStefanExportEntry_(sheetRow, effectiveUser);
}

function mapDashboardEntryToPanelExportRow_(entry, rpIssuePayerMap, factoryBySourceRp) {
  entry = entry || {};
  var isIp = entry.recordType === "ip";
  var sourceRp = normalizeCell_(entry.sourceRp);
  var ownRpKey = normalizeRpKeyForLookup_(entry.rpNum);
  var ownInfo = ownRpKey ? (rpIssuePayerMap[ownRpKey] || null) : null;
  var description = normalizeCell_(entry.desc);
  if (!description && entry.items && entry.items.length) {
    description = normalizeCell_(entry.items[0].description || entry.items[0].displayText);
  }
  if (!description) description = normalizeCell_(entry.itemType);
  var issueValue = normalizeCell_(entry.issue);
  var payerValue = "";
  if (isIp) {
    if (sourceRp) {
      var linkedInfo = getRpIssueAndPayerForExportByRpNum_(sourceRp);
      issueValue = linkedInfo.issue || issueValue;
      payerValue = linkedInfo.payer || "";
    } else {
      payerValue = "ОА";
    }
  } else {
    issueValue = (ownInfo && ownInfo.issue) || issueValue;
    payerValue = (ownInfo && ownInfo.payer) || "";
  }
  payerValue = resolvePanelExportPayerValue_(payerValue, entry, factoryBySourceRp);
  return {
    num: normalizeCell_(entry.rpNum),
    issue: issueValue,
    payer: payerValue,
    boothId: isIp ? normalizeCell_(entry.batch) : normalizeCell_(entry.boothId),
    model: mapAbbreviationToBoothModel_(entry.model),
    colour: normalizeCell_(entry.color),
    clarifications: normalizeCell_(entry.clarification),
    description: description,
    workshopNote: normalizeCell_(entry.workshopNote),
    due: entry.due,
    market: normalizeCell_(entry.market)
  };
}

function collectStefanActivePanelsForExport_(simulatedEmail) {
  var data = getStefanDashboardData("active", simulatedEmail);
  var panels = [];
  var relatedRpNums = [];
  for (var i = 0; i < data.length; i++) {
    if (isStefanActivePanelExportEntry_(data[i])) {
      panels.push(data[i]);
      if (data[i].recordType === "ip" && data[i].sourceRp) {
        relatedRpNums.push(data[i].sourceRp);
      } else {
        relatedRpNums.push(data[i].rpNum);
      }
    }
  }
  panels.sort(function(a, b) {
    return compareDueDates_(a.due, b.due);
  });
  var rpIssuePayerMap = getRpIssuePayerMapForExport_(relatedRpNums);
  var factoryBySourceRp = buildInternalProductionFactoryBySourceRp_();
  var rows = [];
  for (var j = 0; j < panels.length; j++) {
    rows.push(mapDashboardEntryToPanelExportRow_(panels[j], rpIssuePayerMap, factoryBySourceRp));
  }
  return rows;
}

function allPanelExportRowsHaveWorkshopNote_(rows) {
  for (var i = 0; i < rows.length; i++) {
    if (!normalizeCell_(rows[i].workshopNote)) return false;
  }
  return true;
}

function formatPanelExportDueDate_(due) {
  var raw = normalizeCell_(due);
  if (!raw) return "";
  var parsed = parseDueDate_(due);
  if (parsed) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return raw;
}

function estimatePanelExportRowLines_(text, colWidthPx) {
  var val = String(text || "");
  if (!val) return 1;
  var hardLines = val.split(/\r?\n/);
  var charsPerLine = Math.max(6, Math.floor(colWidthPx / 5.8));
  var total = 0;
  for (var i = 0; i < hardLines.length; i++) {
    var lineLen = hardLines[i].length;
    total += Math.max(1, Math.ceil(lineLen / charsPerLine));
  }
  return total;
}

function applyStefanPanelExportRowHeights_(sheet, startRow, endRow, colCount, colWidths) {
  for (var r = startRow; r <= endRow; r++) {
    var maxLines = 1;
    for (var c = 1; c <= colCount; c++) {
      var cellText = sheet.getRange(r, c).getDisplayValue();
      var lines = estimatePanelExportRowLines_(cellText, colWidths[c - 1] || 90);
      if (lines > maxLines) maxLines = lines;
    }
    sheet.setRowHeight(r, Math.min(132, Math.max(22, maxLines * 15 + 8)));
  }
}

function applyStefanPanelExportSheetFormatting_(sheet, rowCount, colCount) {
  var style = STEFAN_PANEL_EXPORT_STYLE_;
  var allRange = sheet.getRange(1, 1, rowCount, colCount);
  var metaRange = sheet.getRange(1, 1, 1, colCount);
  var headerRange = sheet.getRange(2, 1, 2, colCount);
  var dataRange = rowCount > 2 ? sheet.getRange(3, 1, rowCount, colCount) : null;

  allRange.setFontFamily(style.fontFamily);
  allRange.setWrap(true);
  allRange.setVerticalAlignment("top");

  metaRange.setBackground(style.metaBg);
  metaRange.setFontSize(style.metaFontSize);
  sheet.getRange(1, 1, 1, 1).setFontWeight("bold");
  sheet.getRange(1, 2, 1, 1).setHorizontalAlignment("left");
  sheet.getRange(1, 3, 1, colCount).merge();
  sheet.getRange(1, 3).setValue("Резервни Части KAZ");
  sheet.getRange(1, 3).setFontWeight("bold");
  sheet.getRange(1, 3).setHorizontalAlignment("center");

  headerRange.setBackground(style.headerBg);
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(style.headerFontSize);
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");

  metaRange.setVerticalAlignment("middle");
  sheet.getRange(1, 1, 1, 2).setVerticalAlignment("middle");

  if (dataRange) {
    dataRange.setBackground(style.dataBg);
    dataRange.setFontSize(style.dataFontSize);
    dataRange.setFontWeight("normal");
    dataRange.setHorizontalAlignment("left");
    var dataRowCount = rowCount - 2;
    if (dataRowCount > 0) {
      sheet.getRange(3, 3, dataRowCount, 1).setHorizontalAlignment("center"); // Платец
      sheet.getRange(3, 10, dataRowCount, 1).setHorizontalAlignment("center"); // Срок
    }
  }

  allRange.setBorder(
    true, true, true, true, true, true,
    style.borderColor,
    SpreadsheetApp.BorderStyle.SOLID
  );

  sheet.setRowHeight(1, 24);
  sheet.setRowHeight(2, 28);
  for (var c = 1; c <= colCount; c++) {
    sheet.setColumnWidth(c, STEFAN_PANEL_EXPORT_COL_WIDTHS_[c - 1] || 90);
  }
  if (rowCount > 2) {
    applyStefanPanelExportRowHeights_(sheet, 3, rowCount, colCount, STEFAN_PANEL_EXPORT_COL_WIDTHS_);
  }
}

function sanitizePanelExportCell_(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return String(value).replace(/\r\n/g, "\n").trim();
}

function buildStefanPanelExportDocRowValues_(row) {
  return [
    sanitizePanelExportCell_(row.num),
    sanitizePanelExportCell_(row.issue),
    sanitizePanelExportCell_(row.payer),
    sanitizePanelExportCell_(row.boothId),
    sanitizePanelExportCell_(row.model),
    sanitizePanelExportCell_(row.colour),
    sanitizePanelExportCell_(row.clarifications),
    sanitizePanelExportCell_(row.description),
    sanitizePanelExportCell_(row.workshopNote),
    sanitizePanelExportCell_(formatPanelExportDueDate_(row.due)),
    sanitizePanelExportCell_(row.market)
  ];
}

function setPanelExportDocCell_(cell, text, styleOpts) {
  styleOpts = styleOpts || {};
  var style = STEFAN_PANEL_EXPORT_STYLE_;
  cell.clear();
  var para = cell.appendParagraph(text || "");
  para.setFontFamily(style.fontFamily);
  para.setFontSize(styleOpts.fontSize != null ? styleOpts.fontSize : style.dataFontSize);
  if (styleOpts.bold) para.setBold(true);
  if (styleOpts.alignment != null) para.setAlignment(styleOpts.alignment);
  if (styleOpts.backgroundColor) cell.setBackgroundColor(styleOpts.backgroundColor);
  cell.setVerticalAlignment(
    styleOpts.verticalAlign != null
      ? styleOpts.verticalAlign
      : DocumentApp.VerticalAlignment.TOP
  );
  cell.setPaddingTop(styleOpts.padding != null ? styleOpts.padding : 2);
  cell.setPaddingBottom(styleOpts.padding != null ? styleOpts.padding : 2);
  cell.setPaddingLeft(styleOpts.padding != null ? styleOpts.padding : 2);
  cell.setPaddingRight(styleOpts.padding != null ? styleOpts.padding : 2);
}

function appendStefanPanelExportDocMeta_(body, dateStr, exportTitle) {
  exportTitle = exportTitle || FACTORY_PANEL_EXPORT_TITLE_.KAZ;
  var style = STEFAN_PANEL_EXPORT_STYLE_;
  var colWidths = STEFAN_PANEL_EXPORT_DOC_COL_WIDTHS_PT_;
  var metaTable = body.appendTable([["Дата", dateStr, exportTitle]]);
  metaTable.setBorderWidth(1);
  metaTable.setBorderColor(style.borderColor);
  var metaRow = metaTable.getRow(0);
  setPanelExportDocCell_(metaRow.getCell(0), "Дата", {
    fontSize: style.metaFontSize,
    bold: true,
    backgroundColor: style.metaBg,
    verticalAlign: DocumentApp.VerticalAlignment.CENTER,
    padding: 2
  });
  setPanelExportDocCell_(metaRow.getCell(1), dateStr, {
    fontSize: style.metaFontSize,
    backgroundColor: style.metaBg,
    verticalAlign: DocumentApp.VerticalAlignment.CENTER,
    padding: 2
  });
  setPanelExportDocCell_(metaRow.getCell(2), exportTitle, {
    fontSize: style.metaFontSize,
    bold: true,
    alignment: DocumentApp.HorizontalAlignment.CENTER,
    backgroundColor: style.metaBg,
    verticalAlign: DocumentApp.VerticalAlignment.CENTER,
    padding: 2
  });
  var dateColW = colWidths[0] + colWidths[1];
  metaTable.setColumnWidth(0, colWidths[0]);
  metaTable.setColumnWidth(1, colWidths[1]);
  metaTable.setColumnWidth(2, Math.max(120, sumStefanPanelExportDocColWidthsPt_(colWidths) - dateColW));
}

function applyStefanPanelExportDocTableFormatting_(table, dataRowCount, colCount) {
  var style = STEFAN_PANEL_EXPORT_STYLE_;
  table.setBorderWidth(1);
  table.setBorderColor(style.borderColor);

  var headerRow = table.getRow(0);
  for (var h = 0; h < colCount; h++) {
    setPanelExportDocCell_(headerRow.getCell(h), STEFAN_PANEL_EXPORT_HEADERS_[h], {
      fontSize: style.headerFontSize,
      bold: true,
      alignment: DocumentApp.HorizontalAlignment.CENTER,
      backgroundColor: style.headerBg,
      verticalAlign: DocumentApp.VerticalAlignment.CENTER
    });
  }

  for (var r = 0; r < dataRowCount; r++) {
    var dataRow = table.getRow(r + 1);
    for (var d = 0; d < colCount; d++) {
      var align = DocumentApp.HorizontalAlignment.LEFT;
      if (d === 2 || d === 9) align = DocumentApp.HorizontalAlignment.CENTER;
      var cell = dataRow.getCell(d);
      var para = cell.getChild(0).asParagraph();
      para.setFontFamily(style.fontFamily);
      para.setFontSize(style.dataFontSize);
      para.setAlignment(align);
      cell.setBackgroundColor(style.dataBg);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
      cell.setPaddingTop(2);
      cell.setPaddingBottom(2);
      cell.setPaddingLeft(2);
      cell.setPaddingRight(2);
    }
  }

  var colWidths = STEFAN_PANEL_EXPORT_DOC_COL_WIDTHS_PT_;
  for (var w = 0; w < colCount; w++) {
    table.setColumnWidth(w, colWidths[w] || 60);
  }
}

function buildStefanActivePanelsPdfBlob_(rows, exportTitle) {
  var colCount = STEFAN_PANEL_EXPORT_HEADERS_.length;
  var docName = "StefanPanelExport_" + Date.now();
  var doc = DocumentApp.create(docName);
  var body = doc.getBody();
  body.clear();

  var page = STEFAN_PANEL_EXPORT_DOC_PAGE_;
  body.setAttributes({
    [DocumentApp.Attribute.PAGE_WIDTH]: page.widthPt,
    [DocumentApp.Attribute.PAGE_HEIGHT]: page.heightPt
  });
  body.setMarginTop(page.marginPt);
  body.setMarginBottom(page.marginPt);
  body.setMarginLeft(page.marginPt);
  body.setMarginRight(page.marginPt);

  var tableData = [STEFAN_PANEL_EXPORT_HEADERS_.slice()];
  for (var i = 0; i < rows.length; i++) {
    tableData.push(buildStefanPanelExportDocRowValues_(rows[i]));
  }

  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  appendStefanPanelExportDocMeta_(body, dateStr, exportTitle);
  var table = body.appendTable(tableData);
  applyStefanPanelExportDocTableFormatting_(table, rows.length, colCount);

  doc.saveAndClose();
  var docId = doc.getId();
  var pdfBlob = DriveApp.getFileById(docId).getAs("application/pdf");
  DriveApp.getFileById(docId).setTrashed(true);
  return pdfBlob;
}

function buildStefanPanelsPdfResult_(rows, fileNamePrefix) {
  if (!rows.length) {
    return { ok: false, message: "Няма избрани панели." };
  }
  if (!allPanelExportRowsHaveWorkshopNote_(rows)) {
    return {
      ok: false,
      message: "Въведи бележка цех за всички панели"
    };
  }

  var pdfBlob = buildStefanActivePanelsPdfBlob_(rows);
  var pdfBytes = pdfBlob ? pdfBlob.getBytes() : [];
  if (!pdfBytes.length || pdfBytes.length < 500) {
    return { ok: false, message: "PDF export produced an empty file." };
  }
  var fileName =
    fileNamePrefix + "-" +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd") +
    ".pdf";
  return {
    ok: true,
    fileName: fileName,
    mimeType: "application/pdf",
    data: Utilities.base64Encode(pdfBytes),
    exportRowCount: rows.length,
    exportNums: rows.map(function(r) { return sanitizePanelExportCell_(r.num); }),
    exportMode: "styled-doc"
  };
}

function assertStefanDashboardAccess_(simulatedEmail) {
  var userEmail = Session.getActiveUser().getEmail();
  var isAdmin = isAdminUser_(userEmail);
  var effectiveUser = getEffectiveUserEmail_(userEmail, simulatedEmail, isAdmin);
  if (!isStefanDashboardUser_(effectiveUser)) {
    throw new Error("Access denied for Stefan dashboard.");
  }
  return effectiveUser;
}

function extractRecordSortNum_(recordNum) {
  var match = String(recordNum || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function panelExportSelectionKey_(recordType, recordNum) {
  return String(recordType || "rp").toLowerCase() + "|" + normalizeCell_(recordNum).toUpperCase();
}

function buildStefanKazPanelPickerEntryFromRpRow_(row, idx, colBRawDates, effectiveUser) {
  var itemType = normalizeCell_(row[COLUMN_MAP.ITEM_TYPE]);
  if (!isPanelLikeItemTypeForWorkshopNote_(itemType)) return null;
  if (!hasAnyToken_(row[COLUMN_MAP.REVIEW_GROUP], ["KAZ"])) return null;

  var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
  if (!rpNum) return null;

  var loggedDate = colBRawDates[idx] || null;
  var sortTs = loggedDate && !isNaN(loggedDate.getTime()) ? loggedDate.getTime() : 0;
  var part = applyWorkshopNoteToDashboardPart_({
    rpNum: rpNum,
    recordType: "rp",
    itemType: itemType,
    workshopNote: getRpSheetCellDisplay_(row, COLUMN_MAP.WORKSHOP_NOTE, rpNum),
    reviewGroup: row[COLUMN_MAP.REVIEW_GROUP]
  }, effectiveUser, "rp");

  return {
    rpNum: rpNum,
    recordType: "rp",
    status: normalizeCell_(row[COLUMN_MAP.STATUS]),
    boothId: normalizeCell_(row[COLUMN_MAP.BOOTH_ID]),
    model: mapAbbreviationToBoothModel_(row[COLUMN_MAP.MODEL]),
    color: normalizeCell_(row[COLUMN_MAP.COLOR]),
    itemType: itemType,
    clarification: normalizeCell_(row[COLUMN_MAP.CLARIFICATIONS]),
    workshopNote: normalizeCell_(part.workshopNote),
    canEditWorkshopNote: part.canEditWorkshopNote,
    sortTs: sortTs,
    sortNum: extractRecordSortNum_(rpNum)
  };
}

function buildStefanKazPanelPickerEntryFromIpRow_(displayRow, rawRow, rowNum, effectiveUser) {
  var panel = normalizeCell_(displayRow[INTERNAL_PRODUCTION_COL.PANEL - 1]);
  if (!isPanelLikeItemTypeForWorkshopNote_(panel)) return null;
  if (!hasAnyToken_(displayRow[INTERNAL_PRODUCTION_COL.FACTORY - 1], ["KAZ"])) return null;

  var ipNum = normalizeCell_(displayRow[INTERNAL_PRODUCTION_COL.IP_NUM - 1]);
  if (!ipNum) return null;

  var dateVal = rawRow[INTERNAL_PRODUCTION_COL.DATE - 1];
  var sortTs = 0;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    sortTs = dateVal.getTime();
  } else {
    var parsed = parseDueDate_(dateVal);
    if (parsed) sortTs = parsed.getTime();
  }

  var mapped = mapInternalProductionRowToDashboard_(displayRow, {
    viewerEmail: effectiveUser,
    ipRowNum: rowNum
  });

  return {
    rpNum: ipNum,
    recordType: "ip",
    status: normalizeCell_(displayRow[INTERNAL_PRODUCTION_COL.STATUS - 1]),
    boothId: normalizeCell_(displayRow[INTERNAL_PRODUCTION_COL.BATCH - 1]),
    model: mapAbbreviationToBoothModel_(displayRow[INTERNAL_PRODUCTION_COL.MODEL - 1]),
    color: normalizeCell_(displayRow[INTERNAL_PRODUCTION_COL.COLOUR - 1]),
    itemType: panel,
    clarification: normalizeCell_(displayRow[INTERNAL_PRODUCTION_COL.PANEL_CLARIFICATION - 1]),
    workshopNote: normalizeCell_(mapped.workshopNote),
    canEditWorkshopNote: mapped.canEditWorkshopNote,
    sortTs: sortTs,
    sortNum: extractRecordSortNum_(ipNum)
  };
}

function getStefanRecentKazPanelsForPicker(simulatedEmail) {
  var effectiveUser = assertStefanDashboardAccess_(simulatedEmail);
  var entries = [];

  var data = getCachedSheetDisplayValues_();
  if (data.length > 1) {
    var colBRawDates = getCachedColumnBRawDates_();
    for (var i = 1; i < data.length; i++) {
      var rpEntry = buildStefanKazPanelPickerEntryFromRpRow_(data[i], i - 1, colBRawDates, effectiveUser);
      if (rpEntry) entries.push(rpEntry);
    }
  }

  var ipSheet = getInternalProductionSheet_();
  var ipLastRow = ipSheet.getLastRow();
  if (ipLastRow >= 2) {
    var width = INTERNAL_PRODUCTION_LAST_COL_;
    var ipDisplay = ipSheet.getRange(2, 1, ipLastRow, width).getDisplayValues();
    var ipRaw = ipSheet.getRange(2, 1, ipLastRow, width).getValues();
    for (var j = 0; j < ipDisplay.length; j++) {
      if (!isInternalProductionRowPopulated_(ipDisplay[j])) continue;
      var ipEntry = buildStefanKazPanelPickerEntryFromIpRow_(ipDisplay[j], ipRaw[j], j + 2, effectiveUser);
      if (ipEntry) entries.push(ipEntry);
    }
  }

  entries.sort(function(a, b) {
    if (a.sortTs !== b.sortTs) return b.sortTs - a.sortTs;
    return b.sortNum - a.sortNum;
  });

  return entries.slice(0, 20).map(function(entry) {
    return {
      rpNum: entry.rpNum,
      recordType: entry.recordType,
      status: entry.status,
      boothId: entry.boothId,
      model: entry.model,
      color: entry.color,
      itemType: entry.itemType,
      clarification: entry.clarification,
      workshopNote: entry.workshopNote,
      canEditWorkshopNote: entry.canEditWorkshopNote
    };
  });
}

function collectStefanSelectedPanelsForExport_(simulatedEmail, selections) {
  selections = coerceStefanPanelExportSelections_(selections);
  var panels = [];
  var relatedRpNums = [];
  var unresolved = [];

  for (var i = 0; i < selections.length; i++) {
    var sel = selections[i] || {};
    var entry = resolveStefanPanelExportEntryBySelection_(simulatedEmail, sel.rpNum, sel.recordType);
    if (!entry) {
      unresolved.push(normalizeCell_(sel.rpNum) || "?");
      continue;
    }
    if (sel.workshopNote != null && normalizeCell_(sel.workshopNote)) {
      entry.workshopNote = normalizeCell_(sel.workshopNote);
    }
    panels.push(entry);
    if (entry.recordType === "ip" && entry.sourceRp) {
      relatedRpNums.push(entry.sourceRp);
    } else {
      relatedRpNums.push(entry.rpNum);
    }
  }

  panels.sort(function(a, b) {
    return compareDueDates_(a.due, b.due);
  });

  var rpIssuePayerMap = getRpIssuePayerMapForExport_(relatedRpNums);
  var factoryBySourceRp = buildInternalProductionFactoryBySourceRp_();
  var rows = [];
  for (var k = 0; k < panels.length; k++) {
    rows.push(mapDashboardEntryToPanelExportRow_(panels[k], rpIssuePayerMap, factoryBySourceRp));
  }
  return { rows: rows, unresolved: unresolved };
}

function generateStefanActivePanelsPdf(simulatedEmail) {
  assertStefanDashboardAccess_(simulatedEmail);
  var rows = collectStefanActivePanelsForExport_(simulatedEmail);
  return buildStefanPanelsPdfResult_(rows, "Активни-панели");
}

function generateStefanSelectedPanelsPdf(simulatedEmail, selections) {
  assertStefanDashboardAccess_(simulatedEmail);
  if (typeof selections === "string") {
    try {
      selections = JSON.parse(selections);
    } catch (parseErr) {
      selections = [];
    }
  }
  var safeSelections = coerceStefanPanelExportSelections_(selections);
  if (!safeSelections.length) {
    return { ok: false, message: "Няма избрани панели." };
  }
  var collected = collectStefanSelectedPanelsForExport_(simulatedEmail, safeSelections);
  if (collected.unresolved.length) {
    return {
      ok: false,
      message: "Не е намерен запис за: " + collected.unresolved.join(", ")
    };
  }
  if (!collected.rows.length) {
    return { ok: false, message: "Няма избрани панели." };
  }
  return buildStefanPanelsPdfResult_(collected.rows, "Избрани-панели");
}

function isKazPanelUrgencyUrgent_(priority) {
  return normalizeCell_(priority).toLowerCase() === "urgent";
}

function isKazPanelUrgencyStandard_(priority) {
  return !isKazPanelUrgencyUrgent_(priority);
}

function isKazPanelOrderSentMarker_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return true;
  return !!normalizeCell_(value);
}

function isPanelOrderSentMarker_(value) {
  return isKazPanelOrderSentMarker_(value);
}

function resolveFactoryPanelOrderViewerEmail_(factoryGroup) {
  var key = normalizeCell_(factoryGroup).toUpperCase();
  return FACTORY_PANEL_ORDER_VIEWER_EMAIL_[key] || FACTORY_PANEL_ORDER_VIEWER_EMAIL_.KAZ;
}

function resolveFactoryPanelExportTitle_(factoryGroup) {
  var key = normalizeCell_(factoryGroup).toUpperCase();
  return FACTORY_PANEL_EXPORT_TITLE_[key] || FACTORY_PANEL_EXPORT_TITLE_.KAZ;
}

function matchesPanelOrderUrgencyMode_(priority, urgencyMode) {
  if (urgencyMode === "all") return true;
  if (urgencyMode === "standard") return isKazPanelUrgencyStandard_(priority);
  if (urgencyMode === "urgent") return isKazPanelUrgencyUrgent_(priority);
  return true;
}

function isKazPanelOrderSentForRpRow_(row, rowNum) {
  var marker = "";
  if (row && row.length > COLUMN_MAP.ORDER_SENT) {
    marker = row[COLUMN_MAP.ORDER_SENT];
  } else if (rowNum && rowNum > 1) {
    marker = getTargetSheet_().getRange(rowNum, COLUMN_MAP.ORDER_SENT + 1).getDisplayValue();
  }
  return isKazPanelOrderSentMarker_(marker);
}

function isKazPanelOrderSentForIpRow_(row, ipRowNum) {
  var marker = "";
  if (row && row.length >= INTERNAL_PRODUCTION_COL.ORDER_SENT) {
    marker = row[INTERNAL_PRODUCTION_COL.ORDER_SENT - 1];
  } else if (ipRowNum && ipRowNum > 1) {
    marker = getInternalProductionSheet_().getRange(ipRowNum, INTERNAL_PRODUCTION_COL.ORDER_SENT).getDisplayValue();
  }
  return isKazPanelOrderSentMarker_(marker);
}

/** Standard + urgent export: Active, In Production, Briefed, Ready, or Shipped — not Cancelled / AE or U not yet set. */
function matchesKazPanelOrderStatus_(status) {
  var token = normalizeStatusToken_(status);
  if (token === "cancelled") return false;
  if (isOrderedOnAmazonStatus_(status)) return false;
  if (token === "ready" || token === "shipped") return true;
  if (token === "in production" || token === "briefed" || token === "active") return true;
  return matchesNikolayDashboardView_(status, "active");
}

function describePanelOrderAutomationRpExclusion_(row, rowNum, factoryGroup, urgencyMode) {
  var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]) || ("row " + rowNum);
  if (!rowMatchesFactoryGroupForPanelOrder_(row[COLUMN_MAP.REVIEW_GROUP], factoryGroup)) {
    return rpNum + ": column V is '" + normalizeCell_(row[COLUMN_MAP.REVIEW_GROUP]) + "' (need " + factoryGroup + ")";
  }
  if (!isPanelLikeItemTypeForWorkshopNote_(row[COLUMN_MAP.ITEM_TYPE])) {
    return rpNum + ": column K is a part/stock row ('" + normalizeCell_(row[COLUMN_MAP.ITEM_TYPE]) + "')";
  }
  if (isKazPanelOrderSentForRpRow_(row, rowNum)) {
    var sentMarker = getRpSheetCellDisplay_(row, COLUMN_MAP.ORDER_SENT, rpNum);
    return rpNum + ": AE already set ('" + sentMarker + "')";
  }
  if (!matchesKazPanelOrderStatus_(row[COLUMN_MAP.STATUS])) {
    return rpNum + ": status '" + normalizeCell_(row[COLUMN_MAP.STATUS]) + "' not eligible";
  }
  if (!matchesPanelOrderUrgencyMode_(row[COLUMN_MAP.URGENCY], urgencyMode)) {
    return rpNum + ": urgency '" + normalizeCell_(row[COLUMN_MAP.URGENCY]) + "' excluded for mode " + urgencyMode;
  }
  var workshopNote = getRpSheetCellDisplay_(row, COLUMN_MAP.WORKSHOP_NOTE, rpNum);
  if (!normalizeCell_(workshopNote)) {
    return rpNum + ": missing workshop note (column AD / Бележка Цех)";
  }
  return rpNum + ": eligible";
}

function parseKazPanelAddedAt_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  var parsed = parseDueDate_(value);
  if (parsed) return parsed;
  return null;
}

function collectFactoryRpPanelsForOrderAutomation_(factoryGroup, urgencyMode) {
  factoryGroup = normalizeCell_(factoryGroup).toUpperCase();
  var viewerEmail = resolveFactoryPanelOrderViewerEmail_(factoryGroup);
  var sheet = getTargetSheet_();
  var data = getCachedSheetDisplayValues_();
  if (!data || data.length < 2) return [];

  var lastRow = sheet.getLastRow();
  var colBRaw = lastRow >= 2
    ? sheet.getRange(2, 2, lastRow, 2).getValues()
    : [];

  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowNum = i + 1;
    if (!rowMatchesFactoryGroupForPanelOrder_(row[COLUMN_MAP.REVIEW_GROUP], factoryGroup)) continue;
    if (!isPanelLikeItemTypeForWorkshopNote_(row[COLUMN_MAP.ITEM_TYPE])) continue;
    if (isKazPanelOrderSentForRpRow_(row, rowNum)) continue;
    if (!matchesKazPanelOrderStatus_(row[COLUMN_MAP.STATUS])) continue;

    var priority = row[COLUMN_MAP.URGENCY];
    if (!matchesPanelOrderUrgencyMode_(priority, urgencyMode)) continue;

    var workshopNote = getRpSheetCellDisplay_(row, COLUMN_MAP.WORKSHOP_NOTE, row[COLUMN_MAP.RP_NUM]);
    if (!normalizeCell_(workshopNote)) continue;

    var entry = mapRpSheetRowToStefanExportEntry_(row, viewerEmail);
    entry._rowNum = rowNum;
    entry._recordType = "rp";
    if (urgencyMode === "urgent") {
      entry._addedAt = colBRaw[i - 1] ? colBRaw[i - 1][0] : null;
    }
    out.push(entry);
  }
  return out;
}

function collectFactoryIpPanelsForOrderAutomation_(factoryGroup, urgencyMode) {
  factoryGroup = normalizeCell_(factoryGroup).toUpperCase();
  var viewerEmail = resolveFactoryPanelOrderViewerEmail_(factoryGroup);
  var sheet = getInternalProductionSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var width = INTERNAL_PRODUCTION_LAST_COL_;
  var display = sheet.getRange(2, 1, lastRow, width).getDisplayValues();
  var raw = sheet.getRange(2, 1, lastRow, width).getValues();
  var out = [];

  for (var i = 0; i < display.length; i++) {
    var row = display[i];
    var ipRowNum = i + 2;
    if (!isInternalProductionRowPopulated_(row)) continue;
    if (!rowMatchesIpFactoryGroupForPanelOrder_(row[INTERNAL_PRODUCTION_COL.FACTORY - 1], factoryGroup)) continue;
    if (!isPanelLikeItemTypeForWorkshopNote_(row[INTERNAL_PRODUCTION_COL.PANEL - 1])) continue;
    if (isKazPanelOrderSentForIpRow_(row, ipRowNum)) continue;
    if (!matchesKazPanelOrderStatus_(row[INTERNAL_PRODUCTION_COL.STATUS - 1])) continue;

    var priority = row[INTERNAL_PRODUCTION_COL.URGENCY - 1];
    if (!matchesPanelOrderUrgencyMode_(priority, urgencyMode)) continue;

    if (!normalizeCell_(row[INTERNAL_PRODUCTION_COL.WORKSHOP_NOTE - 1])) continue;

    var entry = mapInternalProductionRowToDashboard_(row, {
      viewerEmail: viewerEmail,
      ipRowNum: ipRowNum
    });
    entry._rowNum = ipRowNum;
    entry._recordType = "ip";
    if (urgencyMode === "urgent") {
      entry._addedAt = raw[i][INTERNAL_PRODUCTION_COL.DATE - 1];
    }
    out.push(entry);
  }
  return out;
}

function buildPanelMissingWorkshopNoteEntry_(opts) {
  opts = opts || {};
  var entry = {
    rpNum: normalizeCell_(opts.rpNum),
    factory: normalizeCell_(opts.factory).toUpperCase(),
    urgency: normalizeCell_(opts.urgency) || "Standard",
    status: normalizeCell_(opts.status),
    recordType: opts.recordType || "rp",
    addedAt: opts.addedAt || null
  };
  if (opts.sourceRp) entry.sourceRp = normalizeCell_(opts.sourceRp);
  return entry;
}

function panelMissingWorkshopNoteMeetsMinAge_(addedAt, now, minAgeMs) {
  if (!minAgeMs || minAgeMs <= 0) return true;
  var parsed = parseKazPanelAddedAt_(addedAt);
  if (!parsed) return false;
  now = now || new Date();
  return now.getTime() >= parsed.getTime() + minAgeMs;
}

function collectFactoryRpPanelsMissingWorkshopNote_(factoryGroup, urgencyMode, options) {
  factoryGroup = normalizeCell_(factoryGroup).toUpperCase();
  options = options || {};
  var now = options.now || new Date();
  var minAgeMs = options.minAgeMs || 0;
  var sheet = getTargetSheet_();
  var data = getCachedSheetDisplayValues_();
  if (!data || data.length < 2) return [];

  var lastRow = sheet.getLastRow();
  var colBRaw = lastRow >= 2
    ? sheet.getRange(2, 2, lastRow, 2).getValues()
    : [];

  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowNum = i + 1;
    var rpNum = normalizeCell_(row[COLUMN_MAP.RP_NUM]);
    if (!rpNum) continue;
    if (!rowMatchesFactoryGroupForPanelOrder_(row[COLUMN_MAP.REVIEW_GROUP], factoryGroup)) continue;
    if (!isPanelLikeItemTypeForWorkshopNote_(row[COLUMN_MAP.ITEM_TYPE])) continue;
    if (isKazPanelOrderSentForRpRow_(row, rowNum)) continue;
    if (!matchesKazPanelOrderStatus_(row[COLUMN_MAP.STATUS])) continue;
    if (!matchesPanelOrderUrgencyMode_(row[COLUMN_MAP.URGENCY], urgencyMode)) continue;

    var workshopNote = getRpSheetCellDisplay_(row, COLUMN_MAP.WORKSHOP_NOTE, rpNum);
    if (normalizeCell_(workshopNote)) continue;

    var addedAt = colBRaw[i - 1] ? colBRaw[i - 1][0] : null;
    if (!panelMissingWorkshopNoteMeetsMinAge_(addedAt, now, minAgeMs)) continue;

    out.push(buildPanelMissingWorkshopNoteEntry_({
      rpNum: rpNum,
      factory: factoryGroup,
      urgency: row[COLUMN_MAP.URGENCY],
      status: row[COLUMN_MAP.STATUS],
      recordType: "rp",
      addedAt: addedAt
    }));
  }
  return out;
}

function collectFactoryIpPanelsMissingWorkshopNote_(factoryGroup, urgencyMode, options) {
  factoryGroup = normalizeCell_(factoryGroup).toUpperCase();
  options = options || {};
  var now = options.now || new Date();
  var minAgeMs = options.minAgeMs || 0;
  var sheet = getInternalProductionSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var width = INTERNAL_PRODUCTION_LAST_COL_;
  var display = sheet.getRange(2, 1, lastRow, width).getDisplayValues();
  var raw = sheet.getRange(2, 1, lastRow, width).getValues();
  var out = [];

  for (var i = 0; i < display.length; i++) {
    var row = display[i];
    var ipRowNum = i + 2;
    if (!isInternalProductionRowPopulated_(row)) continue;
    if (!rowMatchesIpFactoryGroupForPanelOrder_(row[INTERNAL_PRODUCTION_COL.FACTORY - 1], factoryGroup)) continue;
    if (!isPanelLikeItemTypeForWorkshopNote_(row[INTERNAL_PRODUCTION_COL.PANEL - 1])) continue;
    if (isKazPanelOrderSentForIpRow_(row, ipRowNum)) continue;
    if (!matchesKazPanelOrderStatus_(row[INTERNAL_PRODUCTION_COL.STATUS - 1])) continue;
    if (!matchesPanelOrderUrgencyMode_(row[INTERNAL_PRODUCTION_COL.URGENCY - 1], urgencyMode)) continue;
    if (normalizeCell_(row[INTERNAL_PRODUCTION_COL.WORKSHOP_NOTE - 1])) continue;

    var ipNum = normalizeCell_(row[INTERNAL_PRODUCTION_COL.IP_NUM - 1]);
    if (!ipNum) continue;
    var addedAt = raw[i][INTERNAL_PRODUCTION_COL.DATE - 1];
    if (!panelMissingWorkshopNoteMeetsMinAge_(addedAt, now, minAgeMs)) continue;

    out.push(buildPanelMissingWorkshopNoteEntry_({
      rpNum: ipNum,
      factory: factoryGroup,
      urgency: row[INTERNAL_PRODUCTION_COL.URGENCY - 1],
      status: row[INTERNAL_PRODUCTION_COL.STATUS - 1],
      recordType: "ip",
      addedAt: addedAt,
      sourceRp: normalizeCell_(row[INTERNAL_PRODUCTION_COL.SOURCE_RP - 1])
    }));
  }
  return out;
}

function dedupePanelMissingWorkshopNoteEntries_(rpEntries, ipEntries) {
  var suppressedRpKeys = {};
  for (var i = 0; i < ipEntries.length; i++) {
    var sourceRp = normalizeCell_(ipEntries[i].sourceRp);
    if (!sourceRp) continue;
    suppressedRpKeys[normalizeRpKeyForLookup_(sourceRp)] = true;
  }
  var rpOut = [];
  for (var r = 0; r < rpEntries.length; r++) {
    var rpKey = normalizeRpKeyForLookup_(rpEntries[r].rpNum);
    if (rpKey && suppressedRpKeys[rpKey]) continue;
    rpOut.push(rpEntries[r]);
  }
  return ipEntries.concat(rpOut);
}

function collectPanelsMissingWorkshopNote_(urgencyMode, options) {
  if (typeof invalidatePartsCache_ === "function") invalidatePartsCache_();
  options = options || {};
  var rpAll = [];
  var ipAll = [];
  for (var f = 0; f < PANEL_ORDER_FACTORY_GROUPS_.length; f++) {
    var factory = PANEL_ORDER_FACTORY_GROUPS_[f];
    rpAll = rpAll.concat(collectFactoryRpPanelsMissingWorkshopNote_(factory, urgencyMode, options));
    ipAll = ipAll.concat(collectFactoryIpPanelsMissingWorkshopNote_(factory, urgencyMode, options));
  }
  return dedupePanelMissingWorkshopNoteEntries_(rpAll, ipAll);
}

function collectKazRpPanelsForOrderAutomation_(urgencyMode) {
  return collectFactoryRpPanelsForOrderAutomation_("KAZ", urgencyMode);
}

function collectKazIpPanelsForOrderAutomation_(urgencyMode) {
  return collectFactoryIpPanelsForOrderAutomation_("KAZ", urgencyMode);
}

function dedupeKazPanelOrderEntries_(rpEntries, ipEntries) {
  var suppressedRpKeys = {};
  for (var i = 0; i < ipEntries.length; i++) {
    var sourceRp = normalizeCell_(ipEntries[i].sourceRp);
    if (!sourceRp) continue;
    suppressedRpKeys[normalizeRpKeyForLookup_(sourceRp)] = true;
  }

  var rpOut = [];
  for (var r = 0; r < rpEntries.length; r++) {
    var rpKey = normalizeRpKeyForLookup_(rpEntries[r].rpNum);
    if (rpKey && suppressedRpKeys[rpKey]) continue;
    rpOut.push(rpEntries[r]);
  }
  return ipEntries.concat(rpOut);
}

function dedupeFactoryPanelOrderEntries_(rpEntries, ipEntries) {
  return dedupeKazPanelOrderEntries_(rpEntries, ipEntries);
}

function collectFactoryPanelsForOrderAutomation_(factoryGroup, urgencyMode) {
  if (typeof invalidatePartsCache_ === "function") invalidatePartsCache_();
  var rpEntries = collectFactoryRpPanelsForOrderAutomation_(factoryGroup, urgencyMode);
  var ipEntries = collectFactoryIpPanelsForOrderAutomation_(factoryGroup, urgencyMode);
  var combined = dedupeFactoryPanelOrderEntries_(rpEntries, ipEntries);
  combined.sort(sortNikolayDashboardEntries_);
  return combined;
}

/**
 * Run in Apps Script to see why RP/IP rows are included or skipped.
 * Example: diagnosePanelOrderAutomation_("VAR", "all")
 */
function diagnosePanelOrderAutomation_(factoryGroup, urgencyMode) {
  factoryGroup = normalizeCell_(factoryGroup).toUpperCase() || "VAR";
  urgencyMode = urgencyMode || (factoryGroup === "KAZ" ? "standard" : "all");
  if (typeof invalidatePartsCache_ === "function") invalidatePartsCache_();

  var lines = [
    "Panel order diagnosis — factory " + factoryGroup + ", urgency mode " + urgencyMode
  ];
  var sheet = getTargetSheet_();
  var data = getCachedSheetDisplayValues_();
  var rpEligible = 0;
  if (data && data.length > 1) {
    lines.push("");
    lines.push("Rep.Parts26:");
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!normalizeCell_(row[COLUMN_MAP.RP_NUM])) continue;
      if (!rowMatchesFactoryGroupForPanelOrder_(row[COLUMN_MAP.REVIEW_GROUP], factoryGroup)) continue;
      var note = describePanelOrderAutomationRpExclusion_(row, i + 1, factoryGroup, urgencyMode);
      lines.push("  " + note);
      if (note.indexOf(": eligible") !== -1) rpEligible++;
    }
  }

  var ipEligible = 0;
  var ipSheet = getInternalProductionSheet_();
  var ipLastRow = ipSheet.getLastRow();
  if (ipLastRow >= 2) {
    var width = INTERNAL_PRODUCTION_LAST_COL_;
    var ipDisplay = ipSheet.getRange(2, 1, ipLastRow, width).getDisplayValues();
    lines.push("");
    lines.push("Internal Production:");
    for (var j = 0; j < ipDisplay.length; j++) {
      var ipRow = ipDisplay[j];
      var ipNum = normalizeCell_(ipRow[INTERNAL_PRODUCTION_COL.IP_NUM - 1]);
      if (!ipNum) continue;
      if (!rowMatchesIpFactoryGroupForPanelOrder_(ipRow[INTERNAL_PRODUCTION_COL.FACTORY - 1], factoryGroup)) continue;
      var ipRowNum = j + 2;
      var ipNote = ipNum + ":";
      if (!isInternalProductionRowPopulated_(ipRow)) ipNote += " row empty";
      else if (!isPanelLikeItemTypeForWorkshopNote_(ipRow[INTERNAL_PRODUCTION_COL.PANEL - 1])) {
        ipNote += " not a panel row";
      } else if (isKazPanelOrderSentForIpRow_(ipRow, ipRowNum)) {
        ipNote += " U already set ('" +
          normalizeCell_(ipRow[INTERNAL_PRODUCTION_COL.ORDER_SENT - 1]) + "')";
      } else if (!matchesKazPanelOrderStatus_(ipRow[INTERNAL_PRODUCTION_COL.STATUS - 1])) {
        ipNote += " status '" + normalizeCell_(ipRow[INTERNAL_PRODUCTION_COL.STATUS - 1]) + "' not eligible";
      } else if (!matchesPanelOrderUrgencyMode_(ipRow[INTERNAL_PRODUCTION_COL.URGENCY - 1], urgencyMode)) {
        ipNote += " urgency excluded for mode " + urgencyMode;
      } else if (!normalizeCell_(ipRow[INTERNAL_PRODUCTION_COL.WORKSHOP_NOTE - 1])) {
        ipNote += " missing workshop note (column T)";
      } else ipNote += " eligible";
      lines.push("  " + ipNote);
      if (ipNote.indexOf(" eligible") !== -1) ipEligible++;
    }
  }

  var collected = collectFactoryPanelsForOrderAutomation_(factoryGroup, urgencyMode);
  lines.push("");
  lines.push("Eligible RP rows: " + rpEligible + ", IP rows: " + ipEligible);
  lines.push("After IP/RP dedupe, export count: " + collected.length);
  if (collected.length) {
    lines.push("Would export: " + collected.map(function(e) { return e.rpNum; }).join(", "));
  }
  var report = lines.join("\n");
  Logger.log(report);
  return report;
}

function collectKazPanelsForOrderAutomation_(urgencyMode) {
  return collectFactoryPanelsForOrderAutomation_("KAZ", urgencyMode);
}

function collectVarPanelsForOrderAutomation_() {
  return collectFactoryPanelsForOrderAutomation_("VAR", "all");
}

function mapKazPanelEntriesToExportRows_(entries) {
  var relatedRpNums = [];
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (entry.recordType === "ip" && entry.sourceRp) {
      relatedRpNums.push(entry.sourceRp);
    } else {
      relatedRpNums.push(entry.rpNum);
    }
  }
  var rpIssuePayerMap = getRpIssuePayerMapForExport_(relatedRpNums);
  var factoryBySourceRp = buildInternalProductionFactoryBySourceRp_();
  var rows = [];
  for (var j = 0; j < entries.length; j++) {
    rows.push(mapDashboardEntryToPanelExportRow_(entries[j], rpIssuePayerMap, factoryBySourceRp));
  }
  return rows;
}

function buildFactoryPanelOrderPdfForAutomation_(entries, fileNamePrefix, factoryGroup) {
  if (!entries.length) {
    return { ok: false, message: "No panels to export.", entries: [] };
  }
  var rows = mapKazPanelEntriesToExportRows_(entries);
  if (!allPanelExportRowsHaveWorkshopNote_(rows)) {
    return { ok: false, message: "Missing workshop note on one or more panels.", entries: entries };
  }
  var exportTitle = resolveFactoryPanelExportTitle_(factoryGroup);
  var pdfBlob = buildStefanActivePanelsPdfBlob_(rows, exportTitle);
  var pdfBytes = pdfBlob ? pdfBlob.getBytes() : [];
  if (!pdfBytes.length || pdfBytes.length < 500) {
    return { ok: false, message: "PDF export produced an empty file.", entries: entries };
  }
  var fileName =
    fileNamePrefix + "-" +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd") +
    ".pdf";
  return {
    ok: true,
    fileName: fileName,
    blob: pdfBlob,
    exportRowCount: rows.length,
    exportNums: rows.map(function(r) { return sanitizePanelExportCell_(r.num); }),
    entries: entries
  };
}

function buildKazPanelOrderPdfForAutomation_(entries, fileNamePrefix) {
  return buildFactoryPanelOrderPdfForAutomation_(entries, fileNamePrefix, "KAZ");
}

function buildVarPanelOrderPdfForAutomation_(entries, fileNamePrefix) {
  return buildFactoryPanelOrderPdfForAutomation_(entries, fileNamePrefix, "VAR");
}

function buildPanelOrderSentMarker_(sentAt) {
  var date = sentAt instanceof Date && !isNaN(sentAt.getTime()) ? sentAt : new Date();
  return new Date(date.getTime());
}

function markKazPanelOrderSent_(entry, sentAt) {
  entry = entry || {};
  var marker = buildPanelOrderSentMarker_(sentAt);
  var recordType = String(entry._recordType || entry.recordType || "rp").toLowerCase();
  if (recordType === "ip") {
    var ipRowNum = entry._rowNum || findRowByIpNum_(entry.rpNum);
    if (!ipRowNum) return false;
    getInternalProductionSheet_().getRange(ipRowNum, INTERNAL_PRODUCTION_COL.ORDER_SENT).setValue(marker);
    return true;
  }
  var rpRowNum = entry._rowNum || findRowByRpNum_(entry.rpNum);
  if (!rpRowNum) return false;
  getTargetSheet_().getRange(rpRowNum, COLUMN_MAP.ORDER_SENT + 1).setValue(marker);
  return true;
}

function markKazPanelOrdersSent_(entries, sentAt) {
  var marker = buildPanelOrderSentMarker_(sentAt);
  var marked = 0;
  for (var i = 0; i < entries.length; i++) {
    if (markKazPanelOrderSent_(entries[i], marker)) marked++;
  }
  if (marked && typeof invalidatePartsCache_ === "function") invalidatePartsCache_();
  return marked;
}

function isKazPanelUrgentOrderDueForSend_(entry, now, delayMs) {
  entry = entry || {};
  now = now || new Date();
  delayMs = delayMs != null ? delayMs : 2 * 60 * 60 * 1000;
  var addedAt = parseKazPanelAddedAt_(entry._addedAt);
  if (!addedAt) return false;
  return now.getTime() >= addedAt.getTime() + delayMs;
}
