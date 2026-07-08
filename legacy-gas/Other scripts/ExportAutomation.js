/** EXPORT AUTOMATION (IZNOS -> Rep.Parts26) */

var EXPORT_AUTOMATION_CONFIG = {
  SOURCE_SPREADSHEET_ID: "1ek1j6DFfTd4BfdI1MiPQedg0jr-V1VoYKHTpXW4DaKs",
  SOURCE_SHEET_NAME: "Износ",
  SOURCE_START_ROW: 3583,
  SOURCE_COL_RP_CODES: 13, // M
  SOURCE_COL_PALLET_KEY: 7, // G
  SOURCE_COL_SECTION_LABEL: 13, // M (searching for "Резервни части")
  SOURCE_COL_HEADER_VALUE: 1, // A (take row above section label)
  SECTION_LABEL_TEXT: "Резервни части",

  TARGET_SHEET_NAME: "Rep.Parts26",
  TARGET_COL_RP_NUM: 1, // A
  TARGET_COL_SHIP_METHOD: 23, // W
  TARGET_COL_STATUS: 24, // X
  TARGET_COL_TRACKING: 25, // Y

  FREIGHT_SPREADSHEET_ID: "1Gfgi6N2fuilpXLcTuqt49tEskoMjF4A0d1eic8Hc7b8",
  FREIGHT_SHEET_NAME: "Freight",
  FREIGHT_START_ROW: 1074,
  FREIGHT_KEY_COL: 6, // F — pallet / ref tokens; any key listed here marks presence for X
  FREIGHT_RP_TEXT_COL: 2, // B — only column scanned for RP codes (e.g. "Soho + RP-127")
  /** Column P — optional; stored in logs only when match is via pallet key in F (ignored for shipped vs not). */
  FREIGHT_STATUS_COL: 16 // P
};

/** Column Y when RP is in Freight B but pallet cannot be resolved (duplicate B rows, or F empty). */
var EXPORT_PALLET_NOT_FOUND_Y_ = "Pallet number not found";

/**
 * Combined export automation:
 * - Column X: Shipped when this RP appears in Freight col B (any row in range). Column P is not used.
 * - Column Y: If RP not in Freight B and Y empty → `{header} Pallet {Износ G}`. If RP in B on exactly one
 *   row: tokens from col F must include the pallet from Износ col G for that line (same normalized token);
 *   then Y = `{header} Pallet {that pallet}`. If F has no tokens, duplicate B rows, or Износ G is not among
 *   F tokens → EXPORT_PALLET_NOT_FOUND_Y_ (overwrites Y).
 */
function ExportAutomation() {
  var sourceSheet = SpreadsheetApp
    .openById(EXPORT_AUTOMATION_CONFIG.SOURCE_SPREADSHEET_ID)
    .getSheetByName(EXPORT_AUTOMATION_CONFIG.SOURCE_SHEET_NAME);
  if (!sourceSheet) {
    throw new Error('Source sheet "' + EXPORT_AUTOMATION_CONFIG.SOURCE_SHEET_NAME + '" not found.');
  }

  var targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXPORT_AUTOMATION_CONFIG.TARGET_SHEET_NAME);
  if (!targetSheet) {
    throw new Error('Target sheet "' + EXPORT_AUTOMATION_CONFIG.TARGET_SHEET_NAME + '" not found.');
  }

  var sourceLastRow = sourceSheet.getLastRow();
  if (sourceLastRow < EXPORT_AUTOMATION_CONFIG.SOURCE_START_ROW) {
    return "No source rows to process.";
  }

  var freightRows = buildFreightRows_();
  var targetContext = buildTargetRpIndex_(targetSheet);
  var targetRpIndex = targetContext.index;
  var rowToRpNum = targetContext.rowToRpNum;
  var targetTrackingByRow = buildTargetColumnMap_(targetSheet, EXPORT_AUTOMATION_CONFIG.TARGET_COL_TRACKING);
  var sectionHeaderBySourceRow = buildSectionHeaderMap_(sourceSheet, sourceLastRow);
  var sourceEntries = buildSourceEntries_(sourceSheet, sourceLastRow);

  var outputUpdates = {};
  var statusUpdates = {};
  var editedRpNumsY = {};
  var editedRpNumsX = {};
  var yUpdateDetailsByRp = {};
  var xUpdateDetailsByRp = {};
  var processedMatches = 0;

  for (var i = 0; i < sourceEntries.length; i++) {
    var entry = sourceEntries[i];
    var sectionHeaderValue = normalizeExportText_(sectionHeaderBySourceRow[entry.rowNum]);
    if (!sectionHeaderValue) continue;

    var outputText = sectionHeaderValue + " Pallet " + entry.palletKey;

    for (var r = 0; r < entry.rpCodes.length; r++) {
      var code = entry.rpCodes[r];
      var frOut = getFreightOutcomeForRp_(entry.palletKey, code, freightRows, sectionHeaderValue);
      var targetRows = targetRpIndex[code];
      if (!targetRows || !targetRows.length) continue;

      for (var t = 0; t < targetRows.length; t++) {
        var targetRowNum = targetRows[t];
        var curY = normalizeExportText_(targetTrackingByRow[targetRowNum]);
        var yToWrite = "";
        if (frOut.yTrackingText !== null && frOut.yTrackingText !== "") {
          yToWrite = frOut.yTrackingText;
        } else if (!curY) {
          yToWrite = outputText;
        }
        if (yToWrite) {
          outputUpdates[targetRowNum] = yToWrite;
          var rpForY = normalizeExportText_(rowToRpNum[targetRowNum]);
          editedRpNumsY[rpForY] = true;
          yUpdateDetailsByRp[rpForY] = yToWrite;
        }
        if (frOut.canShip) {
          statusUpdates[targetRowNum] = "Shipped";
          var rpForX = normalizeExportText_(rowToRpNum[targetRowNum]);
          editedRpNumsX[rpForX] = true;
          xUpdateDetailsByRp[rpForX] = "Shipped (" + frOut.detail + ")";
        }
        processedMatches++;
      }
    }
  }

  applyRowUpdates_(targetSheet, EXPORT_AUTOMATION_CONFIG.TARGET_COL_TRACKING, outputUpdates);
  applyRowUpdates_(targetSheet, EXPORT_AUTOMATION_CONFIG.TARGET_COL_STATUS, statusUpdates);
  if (typeof invalidatePartsCache_ === "function") invalidatePartsCache_();
  var editedY = listEditedRpNums_(editedRpNumsY);
  var editedX = listEditedRpNums_(editedRpNumsX);
  var yDetails = formatDetailsLog_(yUpdateDetailsByRp);
  var xDetails = formatDetailsLog_(xUpdateDetailsByRp);
  Logger.log("ExportAutomation edited Y RPs: " + (editedY || "none"));
  Logger.log("ExportAutomation edited X RPs: " + (editedX || "none"));
  Logger.log("ExportAutomation Y updates (RP -> value): " + (yDetails || "none"));
  Logger.log("ExportAutomation X updates (RP -> status/pallet): " + (xDetails || "none"));
  return "ExportAutomation processed matches: " + processedMatches +
    " | edited Y RPs: " + (editedY || "none") +
    " | edited X RPs: " + (editedX || "none") +
    " | Y updates: " + (yDetails || "none") +
    " | X updates: " + (xDetails || "none");
}

function buildTargetRpIndex_(targetSheet) {
  var lastRow = targetSheet.getLastRow();
  var out = {
    index: {},
    rowToRpNum: {}
  };
  if (lastRow < 2) return out;

  var width = EXPORT_AUTOMATION_CONFIG.TARGET_COL_TRACKING;
  var values = targetSheet.getRange(2, 1, lastRow - 1, width).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    var rowNum = i + 2;
    var row = values[i];
    var rpNum = normalizeExportText_(row[EXPORT_AUTOMATION_CONFIG.TARGET_COL_RP_NUM - 1]);
    if (rpNum) out.rowToRpNum[rowNum] = rpNum;
    var shipMethod = normalizeExportText_(row[EXPORT_AUTOMATION_CONFIG.TARGET_COL_SHIP_METHOD - 1]).toLowerCase();
    var status = normalizeExportText_(row[EXPORT_AUTOMATION_CONFIG.TARGET_COL_STATUS - 1]).toLowerCase();
    var tracking = normalizeExportText_(row[EXPORT_AUTOMATION_CONFIG.TARGET_COL_TRACKING - 1]);

    // Pallet or Container only. Skip Shipped rows unless column Y is empty (retro-fill tracking text).
    var isPalletOrContainer = shipMethod === "pallet" || shipMethod === "container";
    if (!isPalletOrContainer) continue;
    if (status === "shipped" && tracking) continue;

    var normalizedTargetCode = normalizeRpCode_(rpNum);
    if (!normalizedTargetCode) continue;
    if (!out.index[normalizedTargetCode]) out.index[normalizedTargetCode] = [];
    out.index[normalizedTargetCode].push(rowNum);
  }

  return out;
}

/**
 * One object per Freight data row (from FREIGHT_START_ROW): RP codes from col B, pallet tokens from col F.
 */
function buildFreightRows_() {
  var freightSheet = SpreadsheetApp
    .openById(EXPORT_AUTOMATION_CONFIG.FREIGHT_SPREADSHEET_ID)
    .getSheetByName(EXPORT_AUTOMATION_CONFIG.FREIGHT_SHEET_NAME);
  if (!freightSheet) {
    throw new Error('Freight sheet "' + EXPORT_AUTOMATION_CONFIG.FREIGHT_SHEET_NAME + '" not found.');
  }

  var lastRow = freightSheet.getLastRow();
  var rows = [];
  if (lastRow < EXPORT_AUTOMATION_CONFIG.FREIGHT_START_ROW) return rows;

  var width = Math.max(
    EXPORT_AUTOMATION_CONFIG.FREIGHT_KEY_COL,
    EXPORT_AUTOMATION_CONFIG.FREIGHT_STATUS_COL,
    EXPORT_AUTOMATION_CONFIG.FREIGHT_RP_TEXT_COL
  );
  var startRow = EXPORT_AUTOMATION_CONFIG.FREIGHT_START_ROW;
  var data = freightSheet.getRange(startRow, 1, lastRow - startRow + 1, width).getDisplayValues();

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rawB = normalizeExportText_(row[EXPORT_AUTOMATION_CONFIG.FREIGHT_RP_TEXT_COL - 1]);
    var rawF = normalizeExportText_(row[EXPORT_AUTOMATION_CONFIG.FREIGHT_KEY_COL - 1]);
    var statusP = normalizeExportText_(row[EXPORT_AUTOMATION_CONFIG.FREIGHT_STATUS_COL - 1]);
    rows.push({
      rpCodes: extractRpCodes_(rawB),
      palletKeys: extractPalletKeys_(rawF),
      rawF: rawF,
      statusP: statusP
    });
  }

  return rows;
}

/**
 * @returns {{ canShip: boolean, yTrackingText: (string|null), detail: string }}
 *   yTrackingText: non-null string means always write that value to column Y. null means caller may use
 *   Износ default only when Y is currently empty. Single Freight row: Y uses Износ G only if that pallet
 *   token appears among col F tokens; otherwise EXPORT_PALLET_NOT_FOUND_Y_.
 */
function getFreightOutcomeForRp_(entryPalletRaw, rpCode, freightRows, sectionHeaderValue) {
  var rowsWithRp = [];
  for (var i = 0; i < freightRows.length; i++) {
    var fr = freightRows[i];
    var hasRp = false;
    for (var j = 0; j < fr.rpCodes.length; j++) {
      if (fr.rpCodes[j] === rpCode) {
        hasRp = true;
        break;
      }
    }
    if (hasRp) rowsWithRp.push(fr);
  }

  if (!rowsWithRp.length) {
    return { canShip: false, yTrackingText: null, detail: rpCode + " not in Freight col B" };
  }

  if (rowsWithRp.length > 1) {
    return {
      canShip: true,
      yTrackingText: EXPORT_PALLET_NOT_FOUND_Y_,
      detail: rpCode + " in Freight col B on " + rowsWithRp.length + " rows (duplicate)"
    };
  }

  var only = rowsWithRp[0];
  var keys = only.palletKeys;
  if (!keys.length) {
    return {
      canShip: true,
      yTrackingText: EXPORT_PALLET_NOT_FOUND_Y_,
      detail: rpCode + " in Freight col B, col F has no pallet tokens"
    };
  }

  var gKey = normalizePalletKey_(entryPalletRaw);
  if (!gKey || keys.indexOf(gKey) === -1) {
    return {
      canShip: true,
      yTrackingText: EXPORT_PALLET_NOT_FOUND_Y_,
      detail: rpCode + " in B; Износ G=" + entryPalletRaw + " not in Freight F tokens [" + keys.join(", ") + "]"
    };
  }

  var pNote = only.statusP ? "P=" + only.statusP : "P empty";
  return {
    canShip: true,
    yTrackingText: sectionHeaderValue + " Pallet " + gKey,
    detail: rpCode + " in B, matched pallet " + gKey + " (F=" + (only.rawF || keys.join(",")) + ", " + pNote + "; Износ G=" + entryPalletRaw + ")"
  };
}

function buildTargetColumnMap_(targetSheet, columnNum) {
  var lastRow = targetSheet.getLastRow();
  var out = {};
  if (lastRow < 2) return out;

  var values = targetSheet.getRange(2, columnNum, lastRow - 1, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    out[i + 2] = normalizeExportText_(values[i][0]);
  }
  return out;
}

function buildSectionHeaderMap_(sourceSheet, sourceLastRow) {
  var out = {};
  if (sourceLastRow < EXPORT_AUTOMATION_CONFIG.SOURCE_START_ROW) return out;

  var readStartRow = Math.max(1, EXPORT_AUTOMATION_CONFIG.SOURCE_START_ROW - 1);
  var rowCount = sourceLastRow - readStartRow + 1;
  var width = Math.max(EXPORT_AUTOMATION_CONFIG.SOURCE_COL_RP_CODES, EXPORT_AUTOMATION_CONFIG.SOURCE_COL_HEADER_VALUE);
  var values = sourceSheet.getRange(readStartRow, 1, rowCount, width).getDisplayValues();

  var currentHeaderValue = "";
  for (var i = 0; i < values.length; i++) {
    var absoluteRow = readStartRow + i;
    var row = values[i];
    var labelCell = normalizeForLabelMatch_(row[EXPORT_AUTOMATION_CONFIG.SOURCE_COL_SECTION_LABEL - 1]);

    if (labelCell === normalizeForLabelMatch_(EXPORT_AUTOMATION_CONFIG.SECTION_LABEL_TEXT)) {
      var prevIndex = i - 1;
      currentHeaderValue = prevIndex >= 0
        ? normalizeExportText_(values[prevIndex][EXPORT_AUTOMATION_CONFIG.SOURCE_COL_HEADER_VALUE - 1])
        : "";
    }

    if (absoluteRow >= EXPORT_AUTOMATION_CONFIG.SOURCE_START_ROW) {
      out[absoluteRow] = currentHeaderValue;
    }
  }

  return out;
}

function buildSourceEntries_(sourceSheet, sourceLastRow) {
  var rowCount = sourceLastRow - EXPORT_AUTOMATION_CONFIG.SOURCE_START_ROW + 1;
  var sourceValues = sourceSheet.getRange(
    EXPORT_AUTOMATION_CONFIG.SOURCE_START_ROW,
    1,
    rowCount,
    EXPORT_AUTOMATION_CONFIG.SOURCE_COL_RP_CODES
  ).getDisplayValues();

  var out = [];
  for (var i = 0; i < sourceValues.length; i++) {
    var rowNum = EXPORT_AUTOMATION_CONFIG.SOURCE_START_ROW + i;
    var row = sourceValues[i];
    var rawRpCell = normalizeExportText_(row[EXPORT_AUTOMATION_CONFIG.SOURCE_COL_RP_CODES - 1]);
    if (!rawRpCell) continue;

    var rpCodes = extractRpCodes_(rawRpCell);
    if (!rpCodes.length) continue;

    var palletKey = normalizeExportText_(row[EXPORT_AUTOMATION_CONFIG.SOURCE_COL_PALLET_KEY - 1]);
    if (!palletKey) continue;

    out.push({
      rowNum: rowNum,
      rpCodes: rpCodes,
      palletKey: palletKey
    });
  }
  return out;
}

function applyRowUpdates_(sheet, columnNum, updatesByRow) {
  var rows = Object.keys(updatesByRow);
  if (!rows.length) return;

  rows.sort(function(a, b) { return Number(a) - Number(b); });
  for (var i = 0; i < rows.length; i++) {
    var rowNum = Number(rows[i]);
    sheet.getRange(rowNum, columnNum).setValue(updatesByRow[rowNum]);
  }
}

/**
 * Collect RP ids from free text in source column M: RP-123, RP 123, RP12345, en-dash variants, etc.
 */
function extractRpCodes_(text) {
  var normalized = normalizeExportText_(text);
  if (!normalized) return [];

  var upper = normalized.toUpperCase().replace(/[\u2013\u2014]/g, "-");
  var seen = {};
  var out = [];

  function addCode(rawFragment) {
    var code = normalizeRpCode_(rawFragment);
    if (!code || seen[code]) return;
    seen[code] = true;
    out.push(code);
  }

  var reFlexible = /RP\s*[-]?\s*(\d+)/g;
  var m;
  while ((m = reFlexible.exec(upper)) !== null) {
    addCode("RP-" + m[1]);
  }

  var reAttached = /(?:^|[^A-Z0-9])RP(\d{3,8})(?![0-9])/g;
  while ((m = reAttached.exec(upper)) !== null) {
    addCode("RP-" + m[1]);
  }

  var legacy = upper.match(/RP-\d+/g) || [];
  for (var i = 0; i < legacy.length; i++) {
    addCode(legacy[i]);
  }

  return out;
}

function normalizeExportText_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeForLabelMatch_(value) {
  return normalizeExportText_(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeRpCode_(value) {
  var raw = normalizeExportText_(value).toUpperCase();
  if (!raw) return "";

  var rpMatch = raw.match(/RP-(\d+)/);
  if (rpMatch) return "RP-" + Number(rpMatch[1]);

  var numMatch = raw.match(/^\d+$/);
  if (numMatch) return "RP-" + Number(numMatch[0]);

  return "";
}

function extractPalletKeys_(text) {
  var normalized = normalizeExportText_(text).toUpperCase();
  if (!normalized) return [];

  var parts = normalized.split(/[^A-Z0-9]+/).filter(function(part) {
    return part !== "";
  });

  var seen = {};
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var key = normalizePalletKey_(parts[i]);
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.push(key);
  }
  return out;
}

function normalizePalletKey_(value) {
  return normalizeExportText_(value).toUpperCase().replace(/\s+/g, "");
}

function listEditedRpNums_(editedRpNumsMap) {
  var keys = Object.keys(editedRpNumsMap).filter(function(key) {
    return normalizeExportText_(key) !== "";
  });
  keys.sort(function(a, b) { return Number(a) - Number(b); });
  return keys.join(", ");
}

function formatDetailsLog_(detailsByRp) {
  var rps = Object.keys(detailsByRp).filter(function(key) {
    return normalizeExportText_(key) !== "";
  });
  rps.sort(function(a, b) { return Number(a) - Number(b); });
  if (!rps.length) return "";
  return rps.map(function(rp) {
    return rp + " -> " + detailsByRp[rp];
  }).join(" | ");
}


