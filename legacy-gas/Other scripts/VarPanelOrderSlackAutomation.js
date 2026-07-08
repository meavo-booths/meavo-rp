/** VAR panel order PDF → Slack (weekly batch for panels without a sent date in AE/U). */

var VAR_PANEL_ORDER_SLACK_CONFIG = {
  BUSINESS_START_HOUR: 8,
  BUSINESS_END_HOUR: 16
};

function isVarPanelOrderBusinessHours_(date) {
  date = date || new Date();
  var tz = Session.getScriptTimeZone();
  var dow = parseInt(Utilities.formatDate(date, tz, "u"), 10);
  if (!isNaN(dow) && dow >= 6) return false;

  var hm = Utilities.formatDate(date, tz, "HH:mm").split(":");
  var h = parseInt(hm[0], 10);
  var m = parseInt(hm[1], 10);
  if (isNaN(h) || isNaN(m)) return false;
  var mins = h * 60 + m;
  var openMins = VAR_PANEL_ORDER_SLACK_CONFIG.BUSINESS_START_HOUR * 60;
  var closeMins = VAR_PANEL_ORDER_SLACK_CONFIG.BUSINESS_END_HOUR * 60;
  return mins >= openMins && mins < closeMins;
}

function postVarPanelOrderSlackPdf_(entries, fileNamePrefix, messageLines) {
  var built = buildVarPanelOrderPdfForAutomation_(entries, fileNamePrefix);
  if (!built.ok) return built;

  var nums = built.exportNums.join(", ");
  var commentParts = (messageLines || []).slice();
  var warningLines = buildKazPanelReadyShippedWarningLines_(entries);
  if (warningLines.length) commentParts = commentParts.concat(warningLines);
  var comment = commentParts.join("\n");
  if (nums) comment += (comment ? "\n\n" : "") + "Панели: " + nums;

  if (typeof uploadPanelOrderPdfToSlackRecipients_ !== "function") {
    throw new Error("uploadPanelOrderPdfToSlackRecipients_ is not available (KazPanelOrderSlackAutomation.js must be in the project).");
  }
  var delivery = uploadPanelOrderPdfToSlackRecipients_("standard", built.blob, built.fileName, comment);
  markKazPanelOrdersSent_(built.entries);
  return {
    ok: true,
    sentCount: built.exportRowCount,
    exportNums: built.exportNums,
    fileName: built.fileName,
    slackDelivery: delivery,
    deliverySummary: typeof formatPanelOrderSlackDeliverySummary_ === "function"
      ? formatPanelOrderSlackDeliverySummary_(delivery)
      : ""
  };
}

function pushVarPanelOrdersToSlack_(options) {
  options = options || {};
  var entries = collectVarPanelsForOrderAutomation_();
  if (!entries.length) {
    var msg = "No VAR panels pending order export. Run diagnosePanelOrderAutomation_('VAR', 'all') for details.";
    Logger.log("pushVarPanelOrdersToSlack_: " + msg);
    return msg;
  }

  var messageLines = options.manual
    ? ["Резервни Части VAR — ръчно изпращане"]
    : ["Резервни Части VAR — седмична поръчка"];

  var result = postVarPanelOrderSlackPdf_(entries, "VAR-Panels", messageLines);
  if (!result.ok) {
    var failMsg = "Failed: " + result.message;
    Logger.log("pushVarPanelOrdersToSlack_: " + failMsg);
    return failMsg;
  }
  var okMsg = "Sent " + result.sentCount + " VAR panel(s): " + result.exportNums.join(", ") +
    ". " + (result.deliverySummary || "");
  Logger.log("pushVarPanelOrdersToSlack_: " + okMsg);
  return okMsg;
}

/**
 * Weekly: all VAR panels with AE/U empty — Active, Ready, or Shipped (Standard + Urgent).
 * Runs Monday 09:00 (script timezone) via installVarPanelOrderSlackTriggers().
 */
function sendWeeklyVarPanelOrdersToSlack() {
  if (!isVarPanelOrderBusinessHours_()) {
    Logger.log("sendWeeklyVarPanelOrdersToSlack: skipped (outside business hours).");
    return "Skipped: outside business hours.";
  }
  return pushVarPanelOrdersToSlack_({ manual: false });
}

/** One-time: install Monday 09:00 weekly trigger. */
function installVarPanelOrderSlackTriggers() {
  uninstallVarPanelOrderSlackTriggers_();
  ScriptApp.newTrigger("sendWeeklyVarPanelOrdersToSlack")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
  Logger.log("installVarPanelOrderSlackTriggers: installed weekly trigger.");
  return "VAR panel order Slack triggers installed.";
}

function uninstallVarPanelOrderSlackTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendWeeklyVarPanelOrdersToSlack") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/** Manual push: all pending VAR panels (Standard + Urgent) — one PDF, ignores business hours. */
function manualPushPendingVarPanelOrdersToSlack() {
  return pushVarPanelOrdersToSlack_({ manual: true });
}
