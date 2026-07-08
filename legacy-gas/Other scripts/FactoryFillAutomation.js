/** FACTORY FILL AUTOMATION (COLUMN P) */

var FACTORY_FILL_AUTOMATION_CONFIG = {
  TARGET_SHEET: "Rep.Parts26",
  COL_ENTRY_DATE: 2,    // B
  COL_DUE_DATE: 3,      // C
  COL_BOOTH_ID: 9,      // I
  COL_PART_PANEL: 11,   // K
  COL_URGENCY: 7,       // G
  COL_OUTPUT: 22,       // V (KAZ / VAR / AKS or manual factory)
  COL_STATUS: 24        // X
};

/**
 * Recalculate column V for edited rows when I or K changes.
 * If factory (V) is manually added later:
 * - PARTS/STOCK rows: X empty -> Briefed
 * - Standard panel rows with factory AKS/KAZ/VAR: set ETA C if missing, then
 *   X empty -> Briefed (entry day) or In Production (from next calendar day)
 * Simple trigger in Apps Script.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (!sheet || sheet.getName() !== FACTORY_FILL_AUTOMATION_CONFIG.TARGET_SHEET) return;

  var startCol = e.range.getColumn();
  var endCol = startCol + e.range.getNumColumns() - 1;
  var touchedBoothId = startCol <= FACTORY_FILL_AUTOMATION_CONFIG.COL_BOOTH_ID && endCol >= FACTORY_FILL_AUTOMATION_CONFIG.COL_BOOTH_ID;
  var touchedPartPanel = startCol <= FACTORY_FILL_AUTOMATION_CONFIG.COL_PART_PANEL && endCol >= FACTORY_FILL_AUTOMATION_CONFIG.COL_PART_PANEL;
  var touchedFactory = startCol <= FACTORY_FILL_AUTOMATION_CONFIG.COL_OUTPUT && endCol >= FACTORY_FILL_AUTOMATION_CONFIG.COL_OUTPUT;
  var touchedStatus = startCol <= FACTORY_FILL_AUTOMATION_CONFIG.COL_STATUS && endCol >= FACTORY_FILL_AUTOMATION_CONFIG.COL_STATUS;
  if (!touchedBoothId && !touchedPartPanel && !touchedFactory && !touchedStatus) return;

  var startRow = e.range.getRow();
  var rowCount = e.range.getNumRows();
  for (var i = 0; i < rowCount; i++) {
    var rowNum = startRow + i;
    if (touchedBoothId || touchedPartPanel) {
      updateFactoryFillForRow_(sheet, rowNum);
    }
    maybeSetBriefedFromFactory_(sheet, rowNum);
  }
  if (touchedStatus && typeof handleTargetSheetStatusOnEdit_ === "function") {
    handleTargetSheetStatusOnEdit_(e);
  }
}

/**
 * Safe recovery utility: populate ONLY missing values in column V.
 * Useful after large paste operations where simple onEdit may miss rows.
 * This function never overwrites non-empty V values.
 */
function fillMissingFactoryFillColumnV() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FACTORY_FILL_AUTOMATION_CONFIG.TARGET_SHEET);
  if (!sheet) throw new Error('Sheet "' + FACTORY_FILL_AUTOMATION_CONFIG.TARGET_SHEET + '" not found.');

  var lastRow = getLastMeaningfulDataRow_ExcludeA_(sheet);
  if (lastRow < 2) return;

  for (var row = 2; row <= lastRow; row++) {
    var outputVal = normalizeFactoryFillText_(sheet.getRange(row, FACTORY_FILL_AUTOMATION_CONFIG.COL_OUTPUT).getDisplayValue());
    if (outputVal) continue;
    updateFactoryFillForRow_(sheet, row);
    maybeSetBriefedFromFactory_(sheet, row);
  }
}

/**
 * Finds the last row that has any value in B:K.
 * Rows with only prefilled RP number in A are treated as empty.
 */
function getLastMeaningfulDataRow_ExcludeA_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  var numRows = lastRow - 1;
  // B..K = 10 columns
  var values = sheet.getRange(2, 2, numRows, 10).getDisplayValues();

  for (var i = values.length - 1; i >= 0; i--) {
    var row = values[i];
    var hasAny = row.some(function(cell) {
      return normalizeFactoryFillText_(cell) !== "";
    });
    if (hasAny) return i + 2;
  }

  return 1;
}

/**
 * Recalculate factory fill for one row.
 * Can be called from other scripts (e.g. LoggerLogic after setValues).
 */
function recalculateFactoryFillForRow(rowNum) {
  var safeRowNum = Number(rowNum) || 0;
  if (safeRowNum <= 1) return;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FACTORY_FILL_AUTOMATION_CONFIG.TARGET_SHEET);
  if (!sheet) throw new Error('Sheet "' + FACTORY_FILL_AUTOMATION_CONFIG.TARGET_SHEET + '" not found.');
  updateFactoryFillForRow_(sheet, safeRowNum);
  maybeSetBriefedFromFactory_(sheet, safeRowNum);
}

function updateFactoryFillForRow_(sheet, rowNum) {
  var boothIdVal = normalizeFactoryFillText_(sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_BOOTH_ID).getDisplayValue());
  var partPanelVal = normalizeFactoryFillText_(sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_PART_PANEL).getDisplayValue());
  var outputRange = sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_OUTPUT);

  // Populate only if BOTH I (booth ID) and K (part/panel) are filled.
  if (!boothIdVal || !partPanelVal) {
    outputRange.setValue("");
    return;
  }

  // Explicit exclusions from your rule in column K.
  var partPanelUpper = partPanelVal.toUpperCase();
  if (partPanelUpper === "OTHER PARTS" || partPanelUpper === "PART" || partPanelUpper === "PARTS" || partPanelUpper === "STOCK") {
    outputRange.setValue("");
    return;
  }

  // Match trailing token in booth ID: two letters + 2/3 digits (e.g. KB170, VB86, AB122).
  var match = boothIdVal.toUpperCase().match(/([A-Z]{2})(\d{2,3})\s*$/);
  var out = "";
  if (match) {
    var code = match[1];
    if (code === "KB") out = "KAZ";
    if (code === "VB") out = "VAR";
    if (code === "AB") out = "AKS";
  }

  // Business exception: Shelf / Table (S) should route to AKS, not VAR.
  if (out === "VAR" && partPanelUpper === "SHELF / TABLE (S)") {
    out = "AKS";
  }

  outputRange.setValue(out);
}

function normalizeFactoryFillText_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function maybeSetBriefedFromFactory_(sheet, rowNum) {
  if (!sheet || rowNum <= 1) return;

  var factory = normalizeFactoryFillText_(sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_OUTPUT).getDisplayValue());
  if (!factory) return;

  var statusRange = sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_STATUS);
  var status = normalizeFactoryFillText_(statusRange.getDisplayValue());
  var itemType = normalizeFactoryFillText_(sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_PART_PANEL).getDisplayValue());
  var urgency = normalizeFactoryFillText_(sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_URGENCY).getDisplayValue());

  // Existing behavior for parts: factory + empty status => Briefed.
  if (isPartLineByColumnKForFactory_(itemType)) {
    if (status) return;
    if (typeof setTargetSheetStatus_ === "function") {
      setTargetSheetStatus_(sheet, rowNum, "Briefed", status);
    } else {
      statusRange.setValue("Briefed");
    }
    return;
  }

  // New behavior for standard panels when AKS/KAZ/VAR factory is set.
  if (!isStandardPanelFactoryRow_(factory, itemType, urgency)) return;

  ensureStandardPanelEtaIfMissing_(sheet, rowNum);
  var targetStatus = getStandardPanelFactoryTargetStatus_(sheet, rowNum, status);
  if (!targetStatus) return;

  if (typeof setTargetSheetStatus_ === "function") {
    setTargetSheetStatus_(sheet, rowNum, targetStatus, status);
  } else {
    statusRange.setValue(targetStatus);
  }
}

/** Part vs panel: K is PARTS or STOCK → part; anything else → panel. */
function isPartLineByColumnKForFactory_(itemType) {
  var k = normalizeFactoryFillText_(itemType).toUpperCase();
  return k === "PARTS" || k === "STOCK";
}

function isKnownFactoryForStandardPanel_(factory) {
  var f = normalizeFactoryFillText_(factory).toUpperCase();
  return f === "AKS" || f === "KAZ" || f === "VAR";
}

function isStandardPanelFactoryRow_(factory, itemType, urgency) {
  return (
    isKnownFactoryForStandardPanel_(factory) &&
    !isPartLineByColumnKForFactory_(itemType) &&
    normalizeFactoryFillText_(urgency).toLowerCase() === "standard"
  );
}

function ensureStandardPanelEtaIfMissing_(sheet, rowNum) {
  var dueRange = sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_DUE_DATE);
  var currentDue = dueRange.getValue();
  if (currentDue !== "" && currentDue != null) return;

  var entryRaw = sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_ENTRY_DATE).getValue();
  var entryDate = coerceSheetDate_(entryRaw);
  if (!entryDate) return;
  if (typeof computeStandardPanelDeadline_ !== "function") return;

  dueRange.setValue(computeStandardPanelDeadline_(entryDate));
}

function getStandardPanelFactoryTargetStatus_(sheet, rowNum, currentStatus) {
  var statusLower = normalizeFactoryFillText_(currentStatus).toLowerCase();
  if (statusLower && statusLower !== "briefed") return "";

  var entryRaw = sheet.getRange(rowNum, FACTORY_FILL_AUTOMATION_CONFIG.COL_ENTRY_DATE).getValue();
  var entryDate = coerceSheetDate_(entryRaw);
  if (!entryDate) {
    return statusLower ? "" : "Briefed";
  }

  if (isAtLeastOneCalendarDayAfterEntry_(entryDate)) return "In Production";
  if (!statusLower) return "Briefed";
  return "";
}

function coerceSheetDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (value === null || value === undefined || value === "") return null;
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

function isAtLeastOneCalendarDayAfterEntry_(entryDate) {
  var tz = Session.getScriptTimeZone();
  var entryDay = Utilities.formatDate(entryDate, tz, "yyyy-MM-dd");
  var todayDay = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  return todayDay > entryDay;
}

/**
 * Daily sweep for historical/current rows:
 * - Standard panels with AKS/KAZ/VAR factory:
 *   - set ETA (C) if empty
 *   - status empty -> Briefed on entry day, In Production from next day
 *   - status Briefed -> In Production from next day
 */
function runStandardPanelFactoryStatusSweep() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FACTORY_FILL_AUTOMATION_CONFIG.TARGET_SHEET);
  if (!sheet) throw new Error('Sheet "' + FACTORY_FILL_AUTOMATION_CONFIG.TARGET_SHEET + '" not found.');

  var lastRow = getLastMeaningfulDataRow_ExcludeA_(sheet);
  if (lastRow < 2) return "No rows to process.";

  for (var row = 2; row <= lastRow; row++) {
    maybeSetBriefedFromFactory_(sheet, row);
  }
  if (typeof invalidatePartsCache_ === "function") invalidatePartsCache_();
  return "Standard panel factory sweep completed through row " + lastRow + ".";
}

/**
 * One-time setup helper: create daily sweep trigger (safe to re-run).
 */
function createStandardPanelFactoryStatusSweepDailyTrigger() {
  var handler = "runStandardPanelFactoryStatusSweep";
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
}

