/** LOGGER FORM PROCESSING LOGIC */
var ADDRESS_BOOK_CONFIG_ = {
  SPREADSHEET_ID: "1GKrV0I2wHv9y3-Ng0K5n5Ym-4E2waAECZUPBhHZfVzM",
  SHEET_NAME: "Addresses"
};
var PANEL_OPTIONS_CONFIG_ = {
  SPREADSHEET_ID: "1Oce4pafqQTzejsgD6mINOAt-vvexe346d8v72N1rD1I",
  SHEET_NAME: "Panels"
};
/** Shared Drive folder for RP evidence photos (column AC). */
var RP_PHOTOS_DRIVE_FOLDER_ID_ = "14_aVlEj8oghOHNa0DrpvDyHrmoj-vG38";

/** Called on page load / before photo upload to prompt full Drive authorization. */
function warmRpPhotosDriveScope_() {
  var folder = DriveApp.getFolderById(RP_PHOTOS_DRIVE_FOLDER_ID_);
  var probeName = "__rp_logger_drive_warmup__";
  var iter = folder.getFilesByName(probeName);
  while (iter.hasNext()) {
    iter.next().setTrashed(true);
  }
  var probe = folder.createFile(probeName, "warmup", MimeType.PLAIN_TEXT);
  probe.setTrashed(true);
}

/** Client-callable warmup; returns ok:false instead of throwing. */
function warmRpPhotosDriveScopeForClient() {
  try {
    warmRpPhotosDriveScope_();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err && err.message ? err.message : String(err)
    };
  }
}

function isRpPhotoDriveAccessError_(err) {
  var msg = safeValue_(err && err.message ? err.message : err).toLowerCase();
  if (!msg) return false;
  return (
    msg.indexOf("auth/drive") !== -1 ||
    msg.indexOf("driveapp") !== -1 ||
    msg.indexOf("do not have permission") !== -1 ||
    msg.indexOf("authorization is required") !== -1 ||
    msg.indexOf("access not granted") !== -1
  );
}

/**
 * Upload panel photos when possible. On Drive permission errors, skip photos and return
 * warnings so the RP can still be saved.
 */
function tryUploadRpPhotoEntries_(rpNum, items, issueType, existingSheetOpt, existingRowOpt) {
  if (!issueTypeRequiresRpPhoto_(issueType)) {
    return { entries: [], warnings: [] };
  }
  var needsPanelPhoto = false;
  for (var i = 0; i < items.length; i++) {
    if (itemRequiresRpPhoto_(items[i], issueType)) {
      needsPanelPhoto = true;
      break;
    }
  }
  if (!needsPanelPhoto) {
    return { entries: [], warnings: [] };
  }

  try {
    return {
      entries: uploadRpPhotoEntries_(rpNum, items, issueType, existingSheetOpt, existingRowOpt),
      warnings: []
    };
  } catch (err) {
    if (isRpPhotoDriveAccessError_(err)) {
      return {
        entries: [],
        warnings: [{
          code: "DRIVE_ACCESS",
          message: safeValue_(err && err.message ? err.message : err) || "Drive access denied."
        }]
      };
    }
    throw err;
  }
}

function appendRpPhotoUploadWarnings_(target, warnings) {
  if (!warnings || !warnings.length) return;
  if (!target.warnings) target.warnings = [];
  for (var i = 0; i < warnings.length; i++) {
    target.warnings.push(warnings[i]);
  }
  target.photoUploadSkipped = true;
}
var ISSUE_TYPES_REQUIRING_RP_PHOTO_ = {
  "Factory Mistake": true,
  "Faulty Unit": true
};
var ISSUE_TYPES_REQUIRING_RP_REASON_ = {
  "Factory Mistake": true,
  "Faulty Unit": true,
  "Other": true
};
var RP_PHOTO_MAX_BYTES_ = 10 * 1024 * 1024;

function getAddressBookEntries() {
  var ss = SpreadsheetApp.openById(ADDRESS_BOOK_CONFIG_.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(ADDRESS_BOOK_CONFIG_.SHEET_NAME);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
  var seen = {};
  var out = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var address = safeValue_(row[0]);
    if (!address) continue;
    var key = address.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push({
      address: address,
      recipient: safeValue_(row[1]),
      phone: safeValue_(row[2]),
      email: safeValue_(row[3])
    });
  }

  return out;
}

/**
 * Slack notifications must not fail RP save / success response if the bot token,
 * workspace, or network is unhealthy (e.g. Slack error account_inactive).
 */
function safeSyncUrgentSlackForRow_(rowNum) {
  try {
    if (typeof syncUrgentPartsSlackForRow === "function") {
      syncUrgentPartsSlackForRow(rowNum);
    } else if (typeof syncUrgentPanelSlackForRow === "function") {
      syncUrgentPanelSlackForRow(rowNum);
    }
  } catch (slackErr) {
    Logger.log("Slack sync after logger save (row " + rowNum + "): " + slackErr);
  }
}

function getPanelOptionsByBoothModel() {
  var cache = CacheService.getScriptCache();
  var cacheKey = "panel_options_by_model_v1";
  var cachedJson = cache.get(cacheKey);
  if (cachedJson) {
    try {
      return JSON.parse(cachedJson);
    } catch (err) {
      // Rebuild when cache is corrupted.
    }
  }

  var ss = SpreadsheetApp.openById(PANEL_OPTIONS_CONFIG_.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(PANEL_OPTIONS_CONFIG_.SHEET_NAME);
  if (!sheet) return { modelOptions: {}, allOptions: [] };

  var values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return { modelOptions: {}, allOptions: [] };

  var headers = values[0] || [];
  var modelOptions = {};
  var allOptions = [];
  var allSeen = {};

  for (var col = 0; col < headers.length; col++) {
    var header = safeValue_(headers[col]);
    if (!header) continue;
    var modelKey = normalizePanelModelKey_(header);
    if (!modelKey) continue;

    var options = [];
    var seen = {};
    for (var row = 1; row < values.length; row++) {
      var option = safeValue_(values[row][col]);
      if (!option || seen[option]) continue;
      seen[option] = true;
      options.push(option);
      if (!allSeen[option]) {
        allSeen[option] = true;
        allOptions.push(option);
      }
    }

    if (!options.length) continue;
    modelOptions[modelKey] = options;
  }

  var payload = { modelOptions: modelOptions, allOptions: allOptions };
  try {
    cache.put(cacheKey, JSON.stringify(payload), 21600); // 6 hours
  } catch (err) {
    // Ignore cache write failures.
  }
  return payload;
}

var LOGGER_SUBMIT_CACHE_PREFIX_ = "loggerSubmit_v1_";
var LOGGER_SUBMIT_CACHE_TTL_SECONDS_ = 120;

function getCachedLoggerSubmitResult_(submitKey) {
  var key = safeValue_(submitKey);
  if (!key) return null;
  try {
    var hit = CacheService.getScriptCache().get(LOGGER_SUBMIT_CACHE_PREFIX_ + key);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    // Ignore cache read/parse failures.
  }
  return null;
}

function cacheLoggerSubmitResult_(submitKey, result) {
  var key = safeValue_(submitKey);
  if (!key || !result) return;
  try {
    CacheService.getScriptCache().put(
      LOGGER_SUBMIT_CACHE_PREFIX_ + key,
      JSON.stringify(result),
      LOGGER_SUBMIT_CACHE_TTL_SECONDS_
    );
  } catch (err) {
    // Ignore cache write failures.
  }
}

/**
 * New RP logger submit. Serialized per spreadsheet + idempotent when form.submitKey is sent.
 */
function processNewEntry(form) {
  var submitKey = safeValue_(form && form.submitKey);
  var cached = getCachedLoggerSubmitResult_(submitKey);
  if (cached) return cached;

  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) {
    throw new Error(
      "Another save is in progress. Please wait a moment and check your dashboard before submitting again."
    );
  }
  try {
    cached = getCachedLoggerSubmitResult_(submitKey);
    if (cached) return cached;
    var result = processNewEntryBody_(form);
    cacheLoggerSubmitResult_(submitKey, result);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function processNewEntryBody_(form) {
  var sheet = getTargetSheet_();
  if (!sheet) {
    throw new Error("Target sheet not found.");
  }

  var userEmail = Session.getActiveUser().getEmail();
  var items = normalizeItems_(form && form.items);

  if (!items.length) {
    throw new Error("At least one item is required.");
  }
  assertRpReasonWhenRequired_(form && form.issueType, form && form.notes);

  if (shouldSplitItemsIntoSeparateRps_(items)) {
    var rpNums = [];
    var resultWarnings = [];
    for (var i = 0; i < items.length; i++) {
      var targetInfoSplit = findTargetRowInfo_(sheet);
      var rpLabelSplit = resolveRpLabelForTargetRow_(sheet, targetInfoSplit);
      var uploadSplit = tryUploadRpPhotoEntries_(rpLabelSplit, [items[i]], form.issueType);
      if (uploadSplit.warnings.length) {
        resultWarnings = resultWarnings.concat(uploadSplit.warnings);
      }
      var rowDataSplit = getExistingRowBuffer_(sheet, targetInfoSplit.rowNumber);
      populateRowDataFromForm_(rowDataSplit, form, [items[i]], userEmail, true, rpLabelSplit);
      setTargetRowWritableValues_(sheet, targetInfoSplit.rowNumber, rowDataSplit);
      writeRpPhotoHyperlinks_(sheet, targetInfoSplit.rowNumber, uploadSplit.entries);
      if (typeof recalculateFactoryFillForRow === "function") {
        recalculateFactoryFillForRow(targetInfoSplit.rowNumber);
      }
      maybeSetBriefedWhenFactoryAssigned_(sheet, targetInfoSplit.rowNumber);
      safeSyncUrgentSlackForRow_(targetInfoSplit.rowNumber);
      rpNums.push(rpLabelSplit);
    }
    if (typeof invalidatePartsCache_ === "function") invalidatePartsCache_();
    var splitResult = { status: "Success", rpNum: rpNums[0], rpNums: rpNums };
    appendRpPhotoUploadWarnings_(splitResult, resultWarnings);
    return splitResult;
  }

  var targetInfo = findTargetRowInfo_(sheet);
  var rpLabel = resolveRpLabelForTargetRow_(sheet, targetInfo);
  var uploadResult = tryUploadRpPhotoEntries_(rpLabel, items, form.issueType);

  var rowData = getExistingRowBuffer_(sheet, targetInfo.rowNumber);
  populateRowDataFromForm_(rowData, form, items, userEmail, true, rpLabel);

  setTargetRowWritableValues_(sheet, targetInfo.rowNumber, rowData);
  writeRpPhotoHyperlinks_(sheet, targetInfo.rowNumber, uploadResult.entries);
  if (typeof recalculateFactoryFillForRow === "function") {
    recalculateFactoryFillForRow(targetInfo.rowNumber);
  }
  maybeSetBriefedWhenFactoryAssigned_(sheet, targetInfo.rowNumber);
  safeSyncUrgentSlackForRow_(targetInfo.rowNumber);
  if (typeof invalidatePartsCache_ === "function") invalidatePartsCache_();
  var singleResult = {
    status: "Success",
    rpNum: rpLabel
  };
  appendRpPhotoUploadWarnings_(singleResult, uploadResult.warnings);
  return singleResult;
}

function getEditableRpData(rpNum) {
  var sheet = getTargetSheet_();
  if (!sheet) throw new Error("Target sheet not found.");

  var safeRp = safeValue_(rpNum);
  if (!safeRp) throw new Error("RP number is required.");

  var rowNum = findRowByRpNum_(safeRp);
  if (!rowNum) throw new Error("RP not found.");

  var currentUser = safeValue_(Session.getActiveUser().getEmail()).toLowerCase();
  var readWidth = COLUMN_MAP.RP_PHOTO + 1;
  var values = sheet.getRange(rowNum, 1, 1, readWidth).getDisplayValues()[0];
  var rawValues = sheet.getRange(rowNum, 1, 1, readWidth).getValues()[0];
  var owner = safeValue_(values[COLUMN_MAP.USER_ID]).toLowerCase();
  if (!owner || owner !== currentUser) throw new Error("You can edit only your own RPs.");

  var editInfo = getRpEditWindowInfo_(
    rawValues[1], // B raw date
    values[COLUMN_MAP.USER_ID],
    currentUser,
    values[COLUMN_MAP.STATUS]
  );
  if (!editInfo.canEdit) throw new Error(editInfo.reason || "Edit window expired.");

  return {
    rpNum: values[COLUMN_MAP.RP_NUM],
    market: values[COLUMN_MAP.MARKET],
    urgency: values[COLUMN_MAP.URGENCY],
    model: mapAbbreviationToBoothModel_(values[COLUMN_MAP.MODEL]),
    boothId: values[COLUMN_MAP.BOOTH_ID],
    color: values[COLUMN_MAP.COLOR],
    issueType: values[COLUMN_MAP.ISSUE_TYPE],
    notes: values[COLUMN_MAP.NOTES],
    client: values[COLUMN_MAP.CLIENT],
    address: values[COLUMN_MAP.ADDRESS],
    recipient: values[COLUMN_MAP.RECIPIENT],
    phone: values[COLUMN_MAP.PHONE],
    email: values[COLUMN_MAP.EMAIL],
    items: parseItemsForEdit_(values, getPhotoLinkEntriesFromRow_(sheet, rowNum))
  };
}

function getSimilarRpData(rpNum) {
  var sheet = getTargetSheet_();
  if (!sheet) throw new Error("Target sheet not found.");

  var safeRp = safeValue_(rpNum);
  if (!safeRp) throw new Error("RP number is required.");

  var rowNum = findRowByRpNum_(safeRp);
  if (!rowNum) throw new Error("RP not found.");

  var readWidth = COLUMN_MAP.RP_PHOTO + 1;
  var values = sheet.getRange(rowNum, 1, 1, readWidth).getDisplayValues()[0];
  return {
    rpNum: values[COLUMN_MAP.RP_NUM],
    market: values[COLUMN_MAP.MARKET],
    urgency: values[COLUMN_MAP.URGENCY],
    model: mapAbbreviationToBoothModel_(values[COLUMN_MAP.MODEL]),
    boothId: values[COLUMN_MAP.BOOTH_ID],
    color: values[COLUMN_MAP.COLOR],
    issueType: values[COLUMN_MAP.ISSUE_TYPE],
    notes: values[COLUMN_MAP.NOTES],
    client: values[COLUMN_MAP.CLIENT],
    address: values[COLUMN_MAP.ADDRESS],
    recipient: values[COLUMN_MAP.RECIPIENT],
    phone: values[COLUMN_MAP.PHONE],
    email: values[COLUMN_MAP.EMAIL],
    items: parseItemsForEdit_(values, getPhotoLinkEntriesFromRow_(sheet, rowNum))
  };
}

function updateExistingEntry(form) {
  var sheet = getTargetSheet_();
  if (!sheet) throw new Error("Target sheet not found.");

  var safeRp = safeValue_(form && form.rpNum);
  if (!safeRp) throw new Error("RP number is required.");
  var items = normalizeItems_(form && form.items);
  if (!items.length) throw new Error("At least one item is required.");
  if (hasMixedItemTypes_(items)) throw new Error("You cannot mix panel and part items in the same entry.");
  assertRpReasonWhenRequired_(form.issueType, form.notes);

  var rowNum = findRowByRpNum_(safeRp);
  if (!rowNum) throw new Error("RP not found.");

  var currentUser = safeValue_(Session.getActiveUser().getEmail()).toLowerCase();
  var readWidth = COLUMN_MAP.RP_PHOTO + 1;
  var values = sheet.getRange(rowNum, 1, 1, readWidth).getDisplayValues()[0];
  var rawValues = sheet.getRange(rowNum, 1, 1, readWidth).getValues()[0];
  var owner = safeValue_(values[COLUMN_MAP.USER_ID]).toLowerCase();
  if (!owner || owner !== currentUser) throw new Error("You can edit only your own RPs.");

  var editInfo = getRpEditWindowInfo_(
    rawValues[1], // B raw date
    values[COLUMN_MAP.USER_ID],
    currentUser,
    values[COLUMN_MAP.STATUS]
  );
  if (!editInfo.canEdit) throw new Error(editInfo.reason || "Edit window expired.");

  var rowData = getExistingRowBuffer_(sheet, rowNum);
  populateRowDataFromForm_(rowData, form, items, values[COLUMN_MAP.USER_ID], false, safeRp);

  var uploadResult = tryUploadRpPhotoEntries_(safeRp, items, form.issueType, sheet, rowNum);
  setTargetRowWritableValues_(sheet, rowNum, rowData);
  writeRpPhotoHyperlinks_(sheet, rowNum, uploadResult.entries);
  if (typeof recalculateFactoryFillForRow === "function") {
    recalculateFactoryFillForRow(rowNum);
  }
  safeSyncUrgentSlackForRow_(rowNum);

  if (typeof invalidatePartsCache_ === "function") invalidatePartsCache_();
  var editResult = { status: "Success", rpNum: safeRp };
  appendRpPhotoUploadWarnings_(editResult, uploadResult.warnings);
  return editResult;
}

/** Sat/Sun in script timezone (ISO weekday u: 6–7), aligned with business-hours logic. */
function isWeekendDay_(d) {
  var tz = Session.getScriptTimeZone();
  var dow = parseInt(Utilities.formatDate(d, tz, "u"), 10);
  if (!isNaN(dow)) return dow === 6 || dow === 7;
  var day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Script timezone; Mon–Fri 08:00–16:00 counts as business hours (16:00 exactly is after hours).
 * Weekends always return true (outside).
 */
function isOutsideBusinessHours_(date) {
  var tz = Session.getScriptTimeZone();
  var dow = parseInt(Utilities.formatDate(date, tz, "u"), 10);
  // ISO day-of-week: 1 = Monday … 7 = Sunday
  if (!isNaN(dow)) {
    if (dow >= 6) return true;
  } else if (isWeekendDay_(date)) {
    return true;
  }

  var hm = Utilities.formatDate(date, tz, "HH:mm").split(":");
  var h = parseInt(hm[0], 10);
  var m = parseInt(hm[1], 10);
  if (isNaN(h) || isNaN(m)) return true;
  var mins = h * 60 + m;
  var openMins = 8 * 60;
  var closeMins = 16 * 60;
  return mins < openMins || mins >= closeMins;
}

/** Calendar day strictly after entry; skips Sat/Sun (script-local weekday). */
function nextWorkingDayAfterEntry_(entryDate) {
  var d = new Date(entryDate.getTime());
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (isWeekendDay_(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Standard spare parts (K = PARTS or STOCK): nth working day from entry. */
var STANDARD_PART_WORKING_DAYS_ = 5;
/** Standard panels (K not PARTS/STOCK): nth working day from entry. */
var STANDARD_PANEL_WORKING_DAYS_ = 13;

/**
 * Entry day counts as working day 1; deadline is the end of the nth working day (Mon–Fri).
 */
function nthWorkingDayInclusiveFromEntry_(entryDate, n) {
  var d = new Date(entryDate.getTime());
  d.setHours(12, 0, 0, 0);
  var count = 1;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    if (!isWeekendDay_(d)) count++;
  }
  return d;
}

function applyAfterHoursDeadlineNudge_(entryDate, baseDate) {
  if (isOutsideBusinessHours_(entryDate)) {
    return nextWorkingDayAfterEntry_(baseDate);
  }
  return baseDate;
}

/** PARTS or STOCK: urgent → next working day; standard → 5 working days (+ after-hours nudge). */
function computePartOrStockDeadline_(urgency, entryDate) {
  var base;
  if (safeValue_(urgency).toLowerCase() === "urgent") {
    base = nextWorkingDayAfterEntry_(entryDate);
  } else {
    base = nthWorkingDayInclusiveFromEntry_(entryDate, STANDARD_PART_WORKING_DAYS_);
  }
  return applyAfterHoursDeadlineNudge_(entryDate, base);
}

/** Standard panel lines: 13 working days (+ after-hours nudge). */
function computeStandardPanelDeadline_(entryDate) {
  var base = nthWorkingDayInclusiveFromEntry_(entryDate, STANDARD_PANEL_WORKING_DAYS_);
  return applyAfterHoursDeadlineNudge_(entryDate, base);
}

/**
 * Panel / IP deadline helper (not PARTS/STOCK on main sheet).
 * Urgent panels: no auto deadline (set manually on urgent panels dashboard).
 * Standard panels: 13 working days.
 * @returns {Date|null}
 */
function computeShippingDeadlineFromUrgency_(urgency, entryDate) {
  if (safeValue_(urgency).toLowerCase() === "urgent") {
    return null;
  }
  return computeStandardPanelDeadline_(entryDate);
}

/**
 * Auto column C on new RP rows from K + urgency:
 * - PARTS/STOCK + urgent → next working day
 * - PARTS/STOCK + standard → 5 working days
 * - panel + urgent → no auto C (urgent panels dashboard)
 * - panel + standard → 13 working days
 * @returns {Date|null}
 */
function computeAutoDueDateFromColumnKAndUrgency_(itemTypeK, urgency, entryDate) {
  var k = safeValue_(itemTypeK).trim().toUpperCase();
  if (k === "STOCK" || k === "PARTS") {
    return computePartOrStockDeadline_(urgency, entryDate);
  }
  if (safeValue_(urgency).toLowerCase() === "urgent") {
    return null;
  }
  return computeStandardPanelDeadline_(entryDate);
}

function populateRowDataFromForm_(rowData, form, items, userEmail, setEntryDate, rpLabel) {
  rowData[COLUMN_MAP.RP_NUM] = safeValue_(rpLabel);
  var formattedItemType = formatItemTypeForSheet_(items, form.model);
  if (setEntryDate) {
    rowData[1] = new Date(); // B: Entry date
    var autoDue = computeAutoDueDateFromColumnKAndUrgency_(formattedItemType, form.urgency, rowData[1]);
    if (autoDue != null) {
      rowData[COLUMN_MAP.DUE_DATE] = autoDue;
    }
  }
  rowData[COLUMN_MAP.MARKET] = safeValue_(form.market);
  rowData[COLUMN_MAP.USER_ID] = safeValue_(userEmail);
  rowData[COLUMN_MAP.ISSUE_TYPE] = safeValue_(form.issueType);
  rowData[COLUMN_MAP.URGENCY] = safeValue_(form.urgency);
  rowData[COLUMN_MAP.MODEL] = mapBoothModelToAbbreviation_(form.model);
  rowData[COLUMN_MAP.BOOTH_ID] = safeValue_(form.boothId);
  rowData[COLUMN_MAP.COLOR] = safeValue_(form.color);
  rowData[COLUMN_MAP.ITEM_TYPE] = formattedItemType;
  rowData[COLUMN_MAP.QUANTITY] = formatQuantityColumnForSheet_(items);
  rowData[COLUMN_MAP.PART_RP_CODE] = formatPartCodeColumnForSheet_(items);
  rowData[COLUMN_MAP.PART_DESC] = formatDescriptionColumnForSheet_(items);
  rowData[COLUMN_MAP.CLARIFICATIONS] = formatClarificationsColumnForSheet_(items);
  rowData[COLUMN_MAP.NOTES] = safeValue_(form.notes);
  rowData[COLUMN_MAP.CLIENT] = safeValue_(form.client);
  rowData[COLUMN_MAP.ADDRESS] = safeValue_(form.address);
  rowData[COLUMN_MAP.RECIPIENT] = safeValue_(form.recipient);
  rowData[COLUMN_MAP.PHONE] = safeValue_(form.phone);
  rowData[COLUMN_MAP.EMAIL] = safeValue_(form.email);
  rowData[COLUMN_MAP.STATUS] = "";
}

/**
 * After factory fill (column V): if status is still empty and V has a value, set X to Briefed.
 * **Only when column K is PARTS or STOCK** (part); any other K = panel → no auto Briefed. New logger rows only.
 */
function maybeSetBriefedWhenFactoryAssigned_(sheet, rowNum) {
  if (!sheet || rowNum <= 1) return;
  var row = sheet.getRange(rowNum, 1, rowNum, TARGET_SHEET_LAST_WRITABLE_COL_ + 1).getDisplayValues()[0];
  if (safeValue_(row[COLUMN_MAP.STATUS]).trim() !== "") return;
  if (!isPartLineByColumnK_(row[COLUMN_MAP.ITEM_TYPE])) return;
  var factory = safeValue_(row[COLUMN_MAP.REVIEW_GROUP]).trim();
  if (!factory) return;
  setTargetSheetStatus_(sheet, rowNum, "Briefed");
}

/** Part vs panel: K is PARTS or STOCK → part; anything else → panel. */
function isPartLineByColumnK_(itemTypeCell) {
  var k = safeValue_(itemTypeCell).trim().toUpperCase();
  return k === "PARTS" || k === "STOCK";
}

function findTargetRowInfo_(sheet) {
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var scanHeight = Math.max(lastRow - 1, 1);
  var values = sheet.getRange(2, 1, scanHeight, 11).getDisplayValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var market = safeValue_(row[3]); // D
    var model = safeValue_(row[7]);  // H
    var itemType = safeValue_(row[10]); // K
    if (market || model || itemType) continue;

    var currentRpRaw = safeValue_(row[0]);
    var currentRpNorm = normalizeRpLabel_(currentRpRaw);
    if (currentRpNorm) {
      return {
        rowNumber: i + 2,
        currentRp: currentRpNorm
      };
    }

    // Never overwrite existing non-empty values in A if they are invalid RP labels.
    if (!currentRpRaw) {
      return {
        rowNumber: i + 2,
        currentRp: ""
      };
    }
  }

  // Exhausted current sheet rows: append a new block and use first new row.
  var firstNewRow = sheet.getLastRow() + 1;
  sheet.insertRowsAfter(sheet.getLastRow(), 50);
  return {
    rowNumber: firstNewRow,
    currentRp: ""
  };
}

function resolveRpLabelForTargetRow_(sheet, targetInfo) {
  var currentRp = normalizeRpLabel_(targetInfo.currentRp);
  if (currentRp) return currentRp;

  return buildNextRpLabel_(sheet);
}

function buildNextRpLabel_(sheet) {
  var values = sheet.getRange("A:A").getDisplayValues();
  var maxRpNumber = 0;
  for (var i = 0; i < values.length; i++) {
    var raw = safeValue_(values[i][0]);
    if (!raw) continue;
    var match = raw.match(/RP-(\d+)/i) || raw.match(/^(\d+)$/);
    if (!match) continue;
    var num = Number(match[1]);
    if (!isNaN(num) && num > maxRpNumber) {
      maxRpNumber = num;
    }
  }
  return "RP-" + (maxRpNumber + 1);
}

function normalizeRpLabel_(value) {
  var raw = safeValue_(value);
  if (!raw) return "";
  var rpMatch = raw.match(/RP-(\d+)/i);
  if (rpMatch) return "RP-" + Number(rpMatch[1]);
  if (/^\d+$/.test(raw)) return "RP-" + Number(raw);
  return "";
}

function getExistingRowBuffer_(sheet, rowNumber) {
  var n = TARGET_SHEET_LAST_WRITABLE_COL_ + 1;
  if (rowNumber <= sheet.getLastRow()) {
    return sheet.getRange(rowNumber, 1, 1, n).getValues()[0];
  }
  return new Array(n).fill("");
}

function formatItemTypeForSheet_(items, modelValue) {
  if (isStockModel_(modelValue)) return "STOCK";
  if (!items || !items.length) return "";
  if (items.length > 1) return "PARTS";
  var first = items[0] || {};
  var firstType = safeValue_(first.itemType);
  if (firstType === "Part") return "PARTS";
  return safeValue_(first.description);
}

function isStockModel_(modelValue) {
  return safeValue_(modelValue).toUpperCase() === "STOCK";
}

function formatQuantityColumnForSheet_(items) {
  if (!items || !items.length) return "";
  if (items.length > 1) return "Multiple, please take care";
  return safeValue_(items[0].qty);
}

function formatPartCodeColumnForSheet_(items) {
  if (!items || !items.length) return "";
  if (items.length === 1) {
    if (safeValue_(items[0].itemType) !== "Part") return safeValue_(items[0].rpCode);
    return safeValue_(items[0].rpCode);
  }

  return items
    .map(function(item) {
      return safeValue_(item.rpCode);
    })
    .join("\n");
}

function formatDescriptionColumnForSheet_(items) {
  if (!items || !items.length) return "";
  if (items.length === 1) {
    if (safeValue_(items[0].itemType) !== "Part") return safeValue_(items[0].description);
    return safeValue_(items[0].qty) + " x " + safeValue_(items[0].description);
  }

  return items.map(function(item) {
    return safeValue_(item.qty) + " x " + safeValue_(item.description);
  }).join("\n");
}

function formatClarificationsColumnForSheet_(items) {
  if (!items || !items.length) return "";
  if (items.length === 1) {
    if (safeValue_(items[0].itemType) !== "Part") return safeValue_(items[0].itemNotes);
    var singlePartRef = safeValue_(items[0].rpCode) || safeValue_(items[0].description);
    return safeValue_(items[0].qty) + " x " + singlePartRef + ' - "' + safeValue_(items[0].itemNotes) + '"';
  }

  return items.map(function(item) {
    var partRef = safeValue_(item.rpCode) || safeValue_(item.description);
    return safeValue_(item.qty) + " x " + partRef + ' - "' + safeValue_(item.itemNotes) + '"';
  }).join("\n");
}

function normalizeItems_(items) {
  if (!items || !items.length) return [];

  return items.reduce(function(acc, item) {
    var itemType = safeValue_(item.itemType);
    var qty = safeValue_(item.qty) || "1";
    var description = safeValue_(item.description);
    var rpCode = itemType === "Part" ? safeValue_(item.rpCode) : "";
    var itemNotes = safeValue_(item.itemNotes);

    if (!itemType || !qty || !description) {
      return acc;
    }
    if (itemType === "Part") {
      var hasValidCode = /^\d{4}$/.test(rpCode);
      var hasCustomDescription = !!description;
      if (!hasValidCode && !hasCustomDescription) {
        return acc;
      }
    }

    acc.push({
      itemType: itemType,
      qty: qty,
      rpCode: rpCode,
      description: description,
      itemNotes: itemNotes,
      photoBase64: safeValue_(item.photoBase64),
      photoName: safeValue_(item.photoName),
      photoMime: safeValue_(item.photoMime),
      existingPhotoUrl: safeValue_(item.existingPhotoUrl)
    });
    return acc;
  }, []);
}

function issueTypeRequiresRpPhoto_(issueType) {
  return ISSUE_TYPES_REQUIRING_RP_PHOTO_[safeValue_(issueType)] === true;
}

function itemRequiresRpPhoto_(item, issueType) {
  if (!issueTypeRequiresRpPhoto_(issueType)) return false;
  return safeValue_(item && item.itemType) === "Panel";
}

function normalizeIssueTypeForValidation_(issueType) {
  var raw = safeValue_(issueType);
  if (!raw) return "";
  if (/^Other\s*:/i.test(raw)) return "Other";
  return raw;
}

function issueTypeRequiresRpReason_(issueType) {
  return ISSUE_TYPES_REQUIRING_RP_REASON_[normalizeIssueTypeForValidation_(issueType)] === true;
}

function assertRpReasonWhenRequired_(issueType, notes) {
  if (!issueTypeRequiresRpReason_(issueType)) return;
  if (!safeValue_(notes).trim()) {
    throw new Error(
      "Reason for RP is required for Factory Mistake, Faulty Unit, and Other. " +
      "Please state the reason in detail, as this will be used for accounting purposes."
    );
  }
}

function writeRpPhotoHyperlinks_(sheet, rowNum, entries) {
  if (!sheet || rowNum <= 1) return;
  var range = sheet.getRange(rowNum, COLUMN_MAP.RP_PHOTO + 1);
  if (!entries || !entries.length) {
    range.clearContent();
    return;
  }
  if (entries.length === 1) {
    range.setFormula(buildHyperlinkFormula_(entries[0].url, entries[0].label));
    return;
  }
  var builder = SpreadsheetApp.newRichTextValue();
  for (var i = 0; i < entries.length; i++) {
    if (i > 0) builder = builder.appendText("\n");
    builder = builder.appendText(entries[i].label).setLinkUrl(entries[i].url);
  }
  range.setRichTextValue(builder.build());
}

function buildHyperlinkFormula_(url, label) {
  return (
    '=HYPERLINK("' +
    escapeSheetsFormulaString_(url) +
    '","' +
    escapeSheetsFormulaString_(label) +
    '")'
  );
}

function escapeSheetsFormulaString_(value) {
  return String(value || "").replace(/"/g, '""');
}

function normalizeRpLabelForPhoto_(rpNum) {
  var raw = safeValue_(rpNum);
  var normalized = normalizeRpLabel_(raw);
  return normalized || raw.replace(/[\\/:*?"<>|]+/g, "-") || "RP-unknown";
}

function uploadRpPhotoEntries_(rpNum, items, issueType, existingSheetOpt, existingRowOpt) {
  if (!issueTypeRequiresRpPhoto_(issueType)) return [];
  var safeRp = normalizeRpLabelForPhoto_(rpNum);
  if (!safeRp) throw new Error("RP number is required for photo upload.");

  var existingEntries = [];
  if (existingSheetOpt && existingRowOpt) {
    existingEntries = getPhotoLinkEntriesFromRow_(existingSheetOpt, existingRowOpt);
  }
  var parentFolder = DriveApp.getFolderById(RP_PHOTOS_DRIVE_FOLDER_ID_);
  var out = [];
  var panelSlots = [];
  for (var i = 0; i < items.length; i++) {
    if (itemRequiresRpPhoto_(items[i], issueType)) {
      panelSlots.push({ item: items[i] || {}, index: i });
    }
  }
  if (!panelSlots.length) return [];

  var panelCount = panelSlots.length;
  for (var p = 0; p < panelSlots.length; p++) {
    var slot = panelSlots[p];
    var item = slot.item;
    var itemNum = slot.index + 1;
    var label = safeRp;
    var base64 = safeValue_(item.photoBase64);
    if (base64) {
      var bytes = Utilities.base64Decode(base64);
      if (!bytes || bytes.length > RP_PHOTO_MAX_BYTES_) {
        throw new Error("Photo for panel item " + itemNum + " exceeds the 10 MB limit.");
      }
      var mime = normalizeRpPhotoMime_(item.photoMime, item.photoName);
      var fileName = buildRpPhotoFileName_(safeRp, p + 1, panelCount, item.photoName, mime);
      var file = replaceOrCreateFileInFolder_(parentFolder, fileName, bytes, mime);
      out.push({ url: buildDriveFileViewUrl_(file.getId()), label: label });
      continue;
    }
    var existingUrl =
      safeValue_(item.existingPhotoUrl) || safeValue_(existingEntries[p] && existingEntries[p].url);
    if (existingUrl) {
      out.push({ url: existingUrl, label: label });
      continue;
    }
    throw new Error("Photo is required for panel item " + itemNum + ".");
  }
  return out;
}

function replaceOrCreateFileInFolder_(folder, fileName, bytes, mime) {
  var iter = folder.getFilesByName(fileName);
  while (iter.hasNext()) {
    iter.next().setTrashed(true);
  }
  return folder.createFile(Utilities.newBlob(bytes, mime, fileName));
}

function buildRpPhotoFileName_(rpNum, itemIndex, itemCount, originalName, mime) {
  var ext = extensionFromPhotoNameOrMime_(originalName, mime);
  var base = sanitizeRpPhotoFolderName_(rpNum);
  if (itemCount > 1) {
    return base + "-" + itemIndex + ext;
  }
  return base + ext;
}

function extensionFromPhotoNameOrMime_(fileName, mime) {
  var name = safeValue_(fileName).toLowerCase();
  if (name.indexOf(".png") !== -1) return ".png";
  if (name.indexOf(".webp") !== -1) return ".webp";
  if (name.indexOf(".gif") !== -1) return ".gif";
  if (name.indexOf(".pdf") !== -1) return ".pdf";
  if (name.indexOf(".jpeg") !== -1 || name.indexOf(".jpg") !== -1) return ".jpg";
  var m = safeValue_(mime).toLowerCase();
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  if (m === "application/pdf") return ".pdf";
  return ".jpg";
}

function sanitizeRpPhotoFolderName_(rpNum) {
  return normalizeRpLabelForPhoto_(rpNum);
}

function getPhotoLinkEntriesFromRow_(sheet, rowNum) {
  if (!sheet || rowNum <= 1) return [];
  var range = sheet.getRange(rowNum, COLUMN_MAP.RP_PHOTO + 1);
  var formula = safeValue_(range.getFormula());
  if (formula) {
    var fromFormula = parseHyperlinkFormulaEntries_(formula);
    if (fromFormula.length) return fromFormula;
  }
  var rich = range.getRichTextValue();
  if (rich) {
    var fromRich = parseRichTextLinkEntries_(rich);
    if (fromRich.length) return fromRich;
  }
  var display = safeValue_(range.getDisplayValue());
  if (display.indexOf("http") === 0) {
    return [{ url: display, label: display }];
  }
  return [];
}

function parseHyperlinkFormulaEntries_(formula) {
  var out = [];
  var re = /HYPERLINK\s*\(\s*"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"\s*\)/gi;
  var m;
  while ((m = re.exec(formula)) !== null) {
    out.push({
      url: m[1].replace(/""/g, '"'),
      label: m[2].replace(/""/g, '"')
    });
  }
  return out;
}

function parseRichTextLinkEntries_(rich) {
  var runs = rich.getRuns();
  var out = [];
  for (var i = 0; i < runs.length; i++) {
    var run = runs[i];
    var url = safeValue_(run.getLinkUrl());
    if (!url) continue;
    out.push({ url: url, label: safeValue_(run.getText()) || url });
  }
  return out;
}

function normalizeRpPhotoMime_(mime, fileName) {
  var m = safeValue_(mime).toLowerCase();
  if (m.indexOf("image/") === 0 || m === "application/pdf") return m;
  var name = safeValue_(fileName).toLowerCase();
  if (name.indexOf(".png") !== -1) return "image/png";
  if (name.indexOf(".webp") !== -1) return "image/webp";
  if (name.indexOf(".gif") !== -1) return "image/gif";
  if (name.indexOf(".pdf") !== -1) return "application/pdf";
  return "image/jpeg";
}

function buildDriveFileViewUrl_(fileId) {
  return "https://drive.google.com/file/d/" + fileId + "/view";
}

function hasMixedItemTypes_(items) {
  var hasPart = false;
  var hasPanel = false;
  for (var i = 0; i < items.length; i++) {
    var t = safeValue_(items[i] && items[i].itemType);
    if (t === "Part") hasPart = true;
    if (t === "Panel") hasPanel = true;
    if (hasPart && hasPanel) return true;
  }
  return false;
}

/**
 * New entries: multiple parts only → one RP; multiple panels, mixed types, or
 * any non–parts-only multi-item set → one RP per line item.
 */
function shouldSplitItemsIntoSeparateRps_(items) {
  if (!items || items.length <= 1) return false;
  var allParts = items.every(function(item) {
    return safeValue_(item && item.itemType) === "Part";
  });
  return !allParts;
}

function lookupStandardPartnerYesFromCatalogue_(normalizedCode) {
  if (!normalizedCode || typeof getCatalogueData !== "function") return false;
  try {
    var payload = getCatalogueData();
    var categories = (payload && payload.categories) || [];
    for (var ci = 0; ci < categories.length; ci++) {
      var rows = (categories[ci] && categories[ci].rows) || [];
      for (var ri = 0; ri < rows.length; ri++) {
        var row = rows[ri];
        if (!row || row.type !== "item") continue;
        var c = normalizeRpCode_(row.rpCode);
        if (c !== normalizedCode) continue;
        var sp = safeValue_(row.standardPartner).toLowerCase();
        return sp === "yes" || sp === "y" || sp === "true" || sp === "1";
      }
    }
  } catch (err) {
    Logger.log("lookupStandardPartnerYesFromCatalogue_: " + err);
  }
  return false;
}

function lookupSparePartByCode(code) {
  var normalizedCode = normalizeRpCode_(code);
  if (!normalizedCode) {
    return { found: false, code: "", description: "", standardPartnerYes: false };
  }

  var lookupMap = getSparePartLookupMap_();
  var description = safeValue_(lookupMap[normalizedCode]);
  var standardPartnerYes = lookupStandardPartnerYesFromCatalogue_(normalizedCode);
  return {
    found: !!description,
    code: normalizedCode,
    description: description,
    standardPartnerYes: standardPartnerYes
  };
}

function normalizeRpCode_(value) {
  var raw = safeValue_(value);
  var digitsOnly = raw.replace(/\D/g, "");
  if (!/^\d{4}$/.test(digitsOnly)) return "";
  return digitsOnly;
}

function normalizePanelModelKey_(value) {
  var raw = safeValue_(value).toLowerCase();
  if (!raw) return "";
  var flat = raw.replace(/[^a-z0-9]/g, "");
  if (flat === "workstation" || flat === "workstaiton" || flat === "worksation") return "workstation";
  if (flat === "soho") return "soho";
  if (flat === "camden2") return "camden2";
  if (flat === "camden4") return "camden4";
  if (flat === "havenone") return "havenone";
  if (flat === "havenfocus") return "havenfocus";
  if (flat === "haventwo") return "haventwo";
  if (flat === "havenfour") return "havenfour";
  return flat;
}

function safeValue_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function splitMultiValueForEdit_(value) {
  var normalized = safeValue_(value);
  if (!normalized) return [];
  if (normalized.indexOf("\n") !== -1) {
    return normalized.split(/\r?\n/).map(function(v) { return safeValue_(v); }).filter(Boolean);
  }
  if (normalized.indexOf("|") !== -1) {
    return normalized.split("|").map(function(v) { return safeValue_(v); }).filter(Boolean);
  }
  return [normalized];
}

function parseItemsForEdit_(rowValues, photoLinkEntriesOpt) {
  var itemTypeRaw = safeValue_(rowValues[COLUMN_MAP.ITEM_TYPE]);
  var qtyParts = splitMultiValueForEdit_(rowValues[COLUMN_MAP.QUANTITY]);
  var codeParts = splitMultiValueForEdit_(rowValues[COLUMN_MAP.PART_RP_CODE]);
  var descParts = splitMultiValueForEdit_(rowValues[COLUMN_MAP.PART_DESC]);
  var noteParts = splitMultiValueForEdit_(rowValues[COLUMN_MAP.CLARIFICATIONS]);
  var photoLinkEntries = photoLinkEntriesOpt || [];
  var maxLen = Math.max(qtyParts.length, codeParts.length, descParts.length, noteParts.length, photoLinkEntries.length, 1);
  var items = [];

  for (var i = 0; i < maxLen; i++) {
    var qty = safeValue_(qtyParts[i] || "1");
    var codeRaw = safeValue_(codeParts[i]);
    var descRaw = safeValue_(descParts[i]);
    var noteRaw = safeValue_(noteParts[i]);

    var codeMatch = codeRaw.match(/(\d{4})/);
    var rpCode = codeMatch ? codeMatch[1] : "";
    var desc = descRaw.replace(/^\d+\s*x\s*/i, "").trim();
    var note = noteRaw.replace(/^\d+\s*x\s*\d{4}\s*-\s*/i, "").replace(/^"|"$/g, "").trim();

    var itemType = (itemTypeRaw === "PARTS" || itemTypeRaw === "PART" || itemTypeRaw === "STOCK" || !!rpCode) ? "Part" : "Panel";
    if (!desc && itemType === "Panel") {
      desc = itemTypeRaw;
    }
    if (!qty && !rpCode && !desc && !note) continue;
    items.push({
      itemType: itemType,
      qty: qty || "1",
      rpCode: rpCode,
      description: desc,
      itemNotes: note,
      existingPhotoUrl: safeValue_(photoLinkEntries[i] && photoLinkEntries[i].url)
    });
  }

  if (!items.length) {
    items.push({
      itemType: "Part",
      qty: "1",
      rpCode: "",
      description: "",
      itemNotes: "",
      existingPhotoUrl: safeValue_(photoLinkEntries[0] && photoLinkEntries[0].url)
    });
  }
  return items;
}

function mapAbbreviationToBoothModel_(storedModel) {
  var normalized = safeValue_(storedModel).toUpperCase();
  if (normalized === "SO") return "Soho";
  if (normalized === "WS") return "Workstation";
  if (normalized === "C2") return "Camden 2";
  if (normalized === "C4") return "Camden 4";
  if (normalized === "H.O") return "Haven One";
  if (normalized === "H.F") return "Haven Focus";
  if (normalized === "H.2") return "Haven Two";
  if (normalized === "H.4") return "Haven Four";
  if (normalized === "OTHER") return "STOCK";
  return safeValue_(storedModel);
}

function mapBoothModelToAbbreviation_(modelValue) {
  var model = safeValue_(modelValue).toLowerCase();
  if (model === "stock") return "Other";
  var lookup = {
    "soho": "SO",
    "workstation": "WS",
    "workstaiton": "WS",
    "camden 2": "C2",
    "camden 4": "C4",
    "haven one": "H.O",
    "haven focus": "H.F",
    "haven two": "H.2",
    "haven four": "H.4"
  };
  return lookup[model] || safeValue_(modelValue);
}


function getSparePartLookupMap_() {
  var cache = CacheService.getScriptCache();
  var cacheKey = "spare_parts_lookup_map_v1";
  var cachedJson = cache.get(cacheKey);
  if (cachedJson) {
    try {
      return JSON.parse(cachedJson);
    } catch (err) {
      // fall through to rebuild cache
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var codeSheet = ss.getSheetByName("Spare Parts Codes");
  if (!codeSheet) return {};

  var values = codeSheet.getDataRange().getDisplayValues();
  var map = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowCode = normalizeRpCode_(row[0]);
    if (!rowCode) continue;
    var description = safeValue_(row[1]) || safeValue_(row[2]);
    if (!description) continue;
    map[rowCode] = description;
  }

  try {
    cache.put(cacheKey, JSON.stringify(map), 21600); // 6 hours
  } catch (err) {
    // Ignore cache write failures and continue normally.
  }
  return map;
}
