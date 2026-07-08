/** SLACK ALERTS: UNBRIEFED URGENT PANELS */

var SLACK_ALERTS_CONFIG = {
  TARGET_SHEET: "Rep.Parts26",
  WORK_START_HOUR: 9,
  WORK_END_HOUR: 17,
  ESCALATION_HOURS: [1, 4, 8],
  PRODUCTION_WARNING_WORKING_DAYS: 4,
 
  BOT_TOKEN: "xoxb-1655837085858-11105893018084-K923btgoqrxwjYHESXno3ydY",
  /** Production timeline alerts (Briefed/In Production). */
  TARGET_USER_IDS: ["U09FR79K2CB", "U06T0MES8S2"],
  /** Unbriefed urgent panel escalation: 1h → Yavor only; 4h/8h → Boyan + Yavor. */
  UNBRIEFED_ESCALATION_USER_IDS: {
    1: ["U06T0MES8S2"],
    4: ["U09FR79K2CB", "U06T0MES8S2"],
    8: ["U09FR79K2CB", "U06T0MES8S2"]
  }
};

var SLACK_COL = {
  RP_NUM: 1,          // A
  ENTRY_DATE: 2,      // B — date logged (unbriefed escalation only)
  EST_PROD_DATE: 3,   // C — production deadline
  URGENCY: 7,         // G
  BOOTH_ID: 9,    // I
  COLOR: 10,      // J
  ITEM_VALUE: 11, // K
  NOTES: 15,      // O
  FACTORY: 22,    // V
  STATUS: 24      // X
};

/**
 * Main scheduled check. Recommended trigger frequency: every 15 minutes.
 */
function checkAndNotifyUnbriefedUrgentPanels() {
  var now = new Date();
  if (!isWithinWorkingHours_(now)) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SLACK_ALERTS_CONFIG.TARGET_SHEET);
  if (!sheet) throw new Error('Sheet "' + SLACK_ALERTS_CONFIG.TARGET_SHEET + '" not found.');

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var values = sheet.getRange(2, 1, lastRow - 1, 24).getDisplayValues();
  var rawValues = sheet.getRange(2, 1, lastRow - 1, 24).getValues();
  var props = PropertiesService.getScriptProperties();

  for (var i = 0; i < values.length; i++) {
    var rowNum = i + 2;
    var row = values[i];
    var rawRow = rawValues[i];

    var rpNum = norm_(row[SLACK_COL.RP_NUM - 1]);
    var urgency = norm_(row[SLACK_COL.URGENCY - 1]).toLowerCase();
    var itemValue = norm_(row[SLACK_COL.ITEM_VALUE - 1]);
    var status = norm_(row[SLACK_COL.STATUS - 1]);
    var entryDate = rawRow[SLACK_COL.ENTRY_DATE - 1];
    if (!rpNum) continue;

    // Alert system 1: unbriefed urgent escalation at 1h / 4h / 8h working hours.
    if (!status && urgency === "urgent" && !isExcludedItemValue_(itemValue) && entryDate instanceof Date) {
      var workingHoursElapsed = getWorkingHoursBetween_(entryDate, now);
      var escalationHour = getNextEscalationHour_(workingHoursElapsed, props, rpNum);
      if (escalationHour) {
        sendUnbriefedUrgentAlertToSlack_(row, escalationHour, workingHoursElapsed);
        props.setProperty(getEscalationKey_(rpNum, escalationHour), "1");
      }
    } else if (status) {
      // If no longer unbriefed, reset escalation markers.
      clearEscalationMarkers_(props, rpNum);
    }

    // Alert system 2: production timeline monitoring for Briefed/In Production urgent panels.
    if (
      urgency === "urgent" &&
      isProductionStatus_(status) &&
      !isExcludedItemValue_(itemValue)
    ) {
      var productionDeadlineRaw = rawRow[SLACK_COL.EST_PROD_DATE - 1];
      var productionDeadlineDisplay = norm_(row[SLACK_COL.EST_PROD_DATE - 1]);
      var productionDeadline = parseSheetDeadlineDateUrps_(productionDeadlineRaw, productionDeadlineDisplay);
      var productionDeadlineEnd = productionDeadline ? getProductionDeadlineEndMoment_(productionDeadline) : null;
      if (!productionDeadlineEnd) continue;

      var workingHoursToProduction = getWorkingHoursBetween_(now, productionDeadlineEnd);
      var dayHours = SLACK_ALERTS_CONFIG.WORK_END_HOUR - SLACK_ALERTS_CONFIG.WORK_START_HOUR;
      var productionWarningHours = SLACK_ALERTS_CONFIG.PRODUCTION_WARNING_WORKING_DAYS * dayHours;
      // Alert once when remaining time is 4 working days or less (but deadline not yet reached).
      if (workingHoursToProduction > 0 && workingHoursToProduction <= productionWarningHours) {
        var productionApproachingKey = getProductionDateApproachingKey_(rpNum, productionDeadline);
        if (props.getProperty(productionApproachingKey) !== "1") {
          sendProductionDateWarningToSlack_(row, workingHoursToProduction);
          props.setProperty(productionApproachingKey, "1");
        }
      }

      // Alert once when deadline is reached/passed and still in Briefed/In Production.
      if (now.getTime() >= productionDeadlineEnd.getTime()) {
        var productionDeadlineKey = getProductionDeadlineReachedKey_(rpNum, productionDeadline);
        if (props.getProperty(productionDeadlineKey) !== "1") {
          var overdueWorkingHours = getWorkingHoursBetween_(productionDeadlineEnd, now);
          sendProductionDeadlineReachedToSlack_(row, overdueWorkingHours);
          props.setProperty(productionDeadlineKey, "1");
        }
      }
    }
  }
}

/**
 * Helper: create a recurring trigger (every 15 minutes).
 * Run once manually from Apps Script editor.
 */
function createSlackUrgentAlertsTrigger() {
  ScriptApp.newTrigger("checkAndNotifyUnbriefedUrgentPanels")
    .timeBased()
    .everyMinutes(15)
    .create();
}

/**
 * Helper: delete all triggers for this project.
 */
function deleteAllProjectTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
}

function sendUnbriefedUrgentAlertToSlack_(row, escalationHour, workingHoursElapsed) {
  var token = SLACK_ALERTS_CONFIG.BOT_TOKEN;

  var rpNum = norm_(row[SLACK_COL.RP_NUM - 1]);
  var color = norm_(row[SLACK_COL.COLOR - 1]);
  var itemValue = norm_(row[SLACK_COL.ITEM_VALUE - 1]);
  var boothId = norm_(row[SLACK_COL.BOOTH_ID - 1]);
  var factory = norm_(row[SLACK_COL.FACTORY - 1]) || "Unknown Factory";
  var notes = norm_(row[SLACK_COL.NOTES - 1]);

  var escalationLabel = getEscalationLabel_(escalationHour);
  var textLines = [
    ":rotating_light: *Urgent panel not briefed* (" + escalationLabel + " - " + escalationHour + "h)\n" +
    "*RP:* " + rpNum,
    "*Booth ID:* " + boothId,
    "*Color:* " + color,
    "*Item:* " + itemValue
  ];
  if (notes) {
    textLines.push("*Notes:* " + notes);
  }
  textLines.push("*Working hours elapsed:* " + Math.floor(workingHoursElapsed * 10) / 10 + "h");
  textLines.push("This urgent part has not been briefed to *" + factory + "*.");
  var targetUserIds = getUnbriefedEscalationTargetUserIds_(escalationHour);
  postSlackDmToUserIds_(token, textLines.join("\n"), targetUserIds);
}

function openSlackDmChannel_(token, userId) {
  var response = UrlFetchApp.fetch("https://slack.com/api/conversations.open", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ users: userId }),
    muteHttpExceptions: true
  });
  var json = JSON.parse(response.getContentText() || "{}");
  if (!json.ok || !json.channel || !json.channel.id) {
    throw new Error("Slack conversations.open failed: " + (json.error || "unknown_error"));
  }
  return json.channel.id;
}

function sendProductionDateWarningToSlack_(row, workingHoursToProduction) {
  var token = SLACK_ALERTS_CONFIG.BOT_TOKEN;

  var rpNum = norm_(row[SLACK_COL.RP_NUM - 1]);
  var color = norm_(row[SLACK_COL.COLOR - 1]);
  var itemValue = norm_(row[SLACK_COL.ITEM_VALUE - 1]);
  var boothId = norm_(row[SLACK_COL.BOOTH_ID - 1]);
  var factory = norm_(row[SLACK_COL.FACTORY - 1]) || "Unknown Factory";
  var status = norm_(row[SLACK_COL.STATUS - 1]);
  var notes = norm_(row[SLACK_COL.NOTES - 1]);
  var workingDaysRemaining = toSingleDecimal_(workingHoursToProduction / (SLACK_ALERTS_CONFIG.WORK_END_HOUR - SLACK_ALERTS_CONFIG.WORK_START_HOUR));

  var textLines = [
    ":warning: *Production date approaching* (4 working days)",
    "*RP:* " + rpNum,
    "*Booth ID:* " + boothId,
    "*Color:* " + color,
    "*Item:* " + itemValue,
    "*Status:* " + status
  ];
  if (notes) {
    textLines.push("*Notes:* " + notes);
  }
  textLines.push("*Working days to production date:* " + workingDaysRemaining);
  textLines.push("Please ensure this urgent panel is aligned with *" + factory + "*.");
  postSlackDmToTargets_(token, textLines.join("\n"));
}

function sendProductionDeadlineReachedToSlack_(row, overdueWorkingHours) {
  var token = SLACK_ALERTS_CONFIG.BOT_TOKEN;

  var rpNum = norm_(row[SLACK_COL.RP_NUM - 1]);
  var color = norm_(row[SLACK_COL.COLOR - 1]);
  var itemValue = norm_(row[SLACK_COL.ITEM_VALUE - 1]);
  var boothId = norm_(row[SLACK_COL.BOOTH_ID - 1]);
  var factory = norm_(row[SLACK_COL.FACTORY - 1]) || "Unknown Factory";
  var status = norm_(row[SLACK_COL.STATUS - 1]);
  var notes = norm_(row[SLACK_COL.NOTES - 1]);
  var overdueWorkingDays = toSingleDecimal_(overdueWorkingHours / (SLACK_ALERTS_CONFIG.WORK_END_HOUR - SLACK_ALERTS_CONFIG.WORK_START_HOUR));

  var textLines = [
    ":bangbang: *Production deadline reached/passed*",
    "*RP:* " + rpNum,
    "*Booth ID:* " + boothId,
    "*Color:* " + color,
    "*Item:* " + itemValue,
    "*Status:* " + status
  ];
  if (notes) {
    textLines.push("*Notes:* " + notes);
  }
  textLines.push("*Overdue (working days):* " + overdueWorkingDays);
  textLines.push("Deadline is reached while still pending with *" + factory + "*.");
  postSlackDmToTargets_(token, textLines.join("\n"));
}

function getSlackTargetUserIds_() {
  var ids = SLACK_ALERTS_CONFIG.TARGET_USER_IDS || [];
  if (!ids.length && SLACK_ALERTS_CONFIG.TARGET_USER_ID) {
    ids = [SLACK_ALERTS_CONFIG.TARGET_USER_ID];
  }
  return normalizeSlackUserIds_(ids);
}

function getUnbriefedEscalationTargetUserIds_(escalationHour) {
  var map = SLACK_ALERTS_CONFIG.UNBRIEFED_ESCALATION_USER_IDS || {};
  var hourKey = String(Number(escalationHour) || "");
  var ids = map[hourKey] || map[escalationHour] || SLACK_ALERTS_CONFIG.TARGET_USER_IDS || [];
  ids = normalizeSlackUserIds_(ids);
  if (!ids.length) {
    throw new Error("No Slack user IDs configured for unbriefed escalation " + escalationHour + "h.");
  }
  return ids;
}

function normalizeSlackUserIds_(userIds) {
  var out = [];
  var seen = {};
  for (var i = 0; i < (userIds || []).length; i++) {
    var id = norm_(userIds[i]);
    if (!id || seen[id]) continue;
    seen[id] = true;
    out.push(id);
  }
  return out;
}

function postSlackDmToTargets_(token, text) {
  postSlackDmToUserIds_(token, text, getSlackTargetUserIds_());
}

function postSlackDmToUserIds_(token, text, targetUserIds) {
  targetUserIds = normalizeSlackUserIds_(targetUserIds);
  if (!targetUserIds.length) {
    throw new Error("No Slack DM target user IDs configured.");
  }

  for (var i = 0; i < targetUserIds.length; i++) {
    var dmChannelId = openSlackDmChannel_(token, targetUserIds[i]);
    var payload = {
      channel: dmChannelId,
      text: text
    };

    var response = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var json = JSON.parse(response.getContentText() || "{}");
    if (!json.ok) {
      throw new Error("Slack postMessage failed for " + targetUserIds[i] + ": " + (json.error || "unknown_error"));
    }
  }
}

function getNextEscalationHour_(workingHoursElapsed, props, rpNum) {
  var levels = SLACK_ALERTS_CONFIG.ESCALATION_HOURS || [];
  for (var i = 0; i < levels.length; i++) {
    var hour = Number(levels[i]) || 0;
    if (!hour) continue;
    if (workingHoursElapsed >= hour) {
      var key = getEscalationKey_(rpNum, hour);
      if (props.getProperty(key) !== "1") {
        // Always send the earliest unsent escalation first (1h -> 4h -> 8h).
        return hour;
      }
    }
  }
  return 0;
}

function getEscalationKey_(rpNum, escalationHour) {
  return "SLACK_ALERT_SENT_" + rpNum + "_" + escalationHour + "H";
}

function getProductionDateApproachingKey_(rpNum, productionDate) {
  return "SLACK_PROD_DATE_APPROACH_" + rpNum + "_" + Utilities.formatDate(productionDate, Session.getScriptTimeZone(), "yyyyMMdd");
}

function getProductionDeadlineReachedKey_(rpNum, productionDate) {
  return "SLACK_PROD_DATE_REACHED_" + rpNum + "_" + Utilities.formatDate(productionDate, Session.getScriptTimeZone(), "yyyyMMdd");
}

function clearEscalationMarkers_(props, rpNum) {
  var levels = SLACK_ALERTS_CONFIG.ESCALATION_HOURS || [];
  for (var i = 0; i < levels.length; i++) {
    var hour = Number(levels[i]) || 0;
    if (!hour) continue;
    props.deleteProperty(getEscalationKey_(rpNum, hour));
  }
}

function getEscalationLabel_(escalationHour) {
  var levels = SLACK_ALERTS_CONFIG.ESCALATION_HOURS || [];
  for (var i = 0; i < levels.length; i++) {
    if (Number(levels[i]) === Number(escalationHour)) {
      if (i === 0) return "First escalation";
      if (i === 1) return "Second escalation";
      if (i === 2) return "Third escalation";
      return "Escalation " + (i + 1);
    }
  }
  return "Escalation";
}

function isProductionStatus_(status) {
  var s = norm_(status).toUpperCase();
  return s === "BRIEFED" || s === "IN PRODUCTION";
}

/** End of working day on the column C deadline date (date-only cells). */
function getProductionDeadlineEndMoment_(deadlineStart) {
  if (!(deadlineStart instanceof Date) || isNaN(deadlineStart.getTime())) return null;
  var tz = Session.getScriptTimeZone();
  var ymd = Utilities.formatDate(deadlineStart, tz, "yyyy-MM-dd");
  var parts = ymd.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), SLACK_ALERTS_CONFIG.WORK_END_HOUR, 0, 0, 0);
}

function isExcludedItemValue_(itemValue) {
  var upper = norm_(itemValue).toUpperCase();
  return upper === "STOCK" || upper === "PART" || upper === "PARTS" || upper === "OTHER PARTS";
}

function isWithinWorkingHours_(dateObj) {
  if (isWeekend_(dateObj)) return false;
  var hour = dateObj.getHours();
  return hour >= SLACK_ALERTS_CONFIG.WORK_START_HOUR && hour < SLACK_ALERTS_CONFIG.WORK_END_HOUR;
}

function getWorkingHoursBetween_(startDate, endDate) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
  if (endDate <= startDate) return 0;

  var totalMs = 0;
  var cursor = new Date(startDate.getTime());

  while (cursor < endDate) {
    var dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), SLACK_ALERTS_CONFIG.WORK_START_HOUR, 0, 0, 0);
    var dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), SLACK_ALERTS_CONFIG.WORK_END_HOUR, 0, 0, 0);

    if (!isWeekend_(cursor)) {
      var segmentStart = cursor > dayStart ? cursor : dayStart;
      var segmentEnd = endDate < dayEnd ? endDate : dayEnd;
      if (segmentEnd > segmentStart) {
        totalMs += (segmentEnd.getTime() - segmentStart.getTime());
      }
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, SLACK_ALERTS_CONFIG.WORK_START_HOUR, 0, 0, 0);
  }

  return totalMs / 3600000;
}

function isWeekend_(dateObj) {
  var day = dateObj.getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

function norm_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toSingleDecimal_(num) {
  return Math.floor(num * 10) / 10;
}

