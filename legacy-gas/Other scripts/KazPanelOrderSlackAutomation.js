/** KAZ panel order PDF → Slack (weekly standard batch, urgent sweep every 2h).
 *
 * Slack app Bot Token Scopes (OAuth & Permissions → Scopes → Bot Token Scopes):
 *   chat:write   — text messages (workshop-note warnings)
 *   im:write     — open 1:1 DMs (conversations.open)
 *   files:write  — panel PDF upload (getUploadURLExternal + completeUploadExternal)
 *
 * After adding scopes: reinstall the app to the workspace so the bot token is re-issued.
 */

var PANEL_ORDER_SLACK_DM_RECIPIENTS_ = {
  /** Urgent panel PDFs: Boyan, Yavor */
  URGENT_USER_IDS: ["U09FR79K2CB", "U06T0MES8S2"],
  /** Standard KAZ + VAR weekly PDFs: Boyan, Kalin */
  STANDARD_USER_IDS: ["U09FR79K2CB", "U01KQQ1NQMB"]
};

var KAZ_PANEL_ORDER_SLACK_CONFIG = {
  /** How often the urgent sweep runs (hours). Re-install triggers after changing. */
  URGENT_SWEEP_HOURS: 2,
  /** Daily check for Standard panels missing Бележка Цех (1+ day after entry). */
  STANDARD_MISSING_WORKSHOP_NOTE_DAILY_HOUR: 10,
  BUSINESS_START_HOUR: 8,
  BUSINESS_END_HOUR: 16
};

var PANEL_MISSING_WORKSHOP_NOTE_WARN_KEY_PREFIX_ = "MWN_STD_";

function isKazPanelOrderBusinessHours_(date) {
  date = date || new Date();
  var tz = Session.getScriptTimeZone();
  var dow = parseInt(Utilities.formatDate(date, tz, "u"), 10);
  if (!isNaN(dow) && dow >= 6) return false;

  var hm = Utilities.formatDate(date, tz, "HH:mm").split(":");
  var h = parseInt(hm[0], 10);
  var m = parseInt(hm[1], 10);
  if (isNaN(h) || isNaN(m)) return false;
  var mins = h * 60 + m;
  var openMins = KAZ_PANEL_ORDER_SLACK_CONFIG.BUSINESS_START_HOUR * 60;
  var closeMins = KAZ_PANEL_ORDER_SLACK_CONFIG.BUSINESS_END_HOUR * 60;
  return mins >= openMins && mins < closeMins;
}

function normalizePanelOrderSlackUserIds_(userIds) {
  var out = [];
  var seen = {};
  for (var i = 0; i < (userIds || []).length; i++) {
    var id = normalizeCell_(userIds[i]);
    if (!id || seen[id]) continue;
    seen[id] = true;
    out.push(id);
  }
  return out;
}

function resolvePanelOrderSlackRecipientUserIds_(recipientKind) {
  var cfg = PANEL_ORDER_SLACK_DM_RECIPIENTS_ || {};
  var kind = String(recipientKind || "").toLowerCase();
  var list = cfg.STANDARD_USER_IDS;
  if (kind === "urgent") list = cfg.URGENT_USER_IDS;
  else if (kind === "workshop_note_warn") list = cfg.STANDARD_USER_IDS;
  var userIds = normalizePanelOrderSlackUserIds_(list);
  if (!userIds.length) {
    throw new Error("No Slack user IDs configured for panel order PDF (" + recipientKind + ").");
  }
  return userIds;
}

function formatPanelOrderSlackDeliverySummary_(delivery) {
  delivery = delivery || {};
  if (!delivery.ok) return "";
  var parts = ["Slack confirmed"];
  if (delivery.fileName) parts.push("file=" + delivery.fileName);
  if (delivery.slackFileId) parts.push("slackFileId=" + delivery.slackFileId);
  if (delivery.slackMessageTs) parts.push("messageTs=" + delivery.slackMessageTs);
  if (delivery.channelId) parts.push("channel=" + delivery.channelId);
  if (delivery.channelIds && delivery.channelIds.length > 1) {
    parts.push("channels=" + delivery.channelIds.join(", "));
  }
  if (delivery.recipientUserIds && delivery.recipientUserIds.length) {
    parts.push("recipientUserIds=" + delivery.recipientUserIds.join(", "));
  }
  return parts.join(" | ");
}

function openPanelOrderSlackDmChannelForUser_(userId) {
  if (typeof openSlackDmChannelUrps_ !== "function") {
    throw new Error("openSlackDmChannelUrps_ is not available (RPSlackBot.js must be in the project).");
  }
  return openSlackDmChannelUrps_(normalizeCell_(userId));
}

function postPanelOrderSlackTextToRecipients_(recipientKind, text) {
  if (typeof callSlackApiUrps_ !== "function") {
    throw new Error("callSlackApiUrps_ is not available (RPSlackBot.js must be in the project).");
  }
  var userIds = resolvePanelOrderSlackRecipientUserIds_(recipientKind);
  var channelIds = [];
  var messageTs = [];
  for (var i = 0; i < userIds.length; i++) {
    var dmChannelId = openPanelOrderSlackDmChannelForUser_(userIds[i]);
    var postResp = callSlackApiUrps_("chat.postMessage", {
      channel: dmChannelId,
      text: String(text || "")
    });
    var postJson = JSON.parse(postResp.getContentText() || "{}");
    if (!postJson.ok) {
      throw new Error("Slack chat.postMessage failed for " + userIds[i] + ": " +
        (postJson.error || postResp.getContentText()));
    }
    channelIds.push(dmChannelId);
    messageTs.push(postJson.ts || "");
  }
  var delivery = {
    ok: true,
    recipientKind: recipientKind,
    recipientUserIds: userIds.slice(),
    channelIds: channelIds,
    channelId: channelIds.join(","),
    slackMessageTs: messageTs.join(",")
  };
  Logger.log("postPanelOrderSlackTextToRecipients_: " + formatPanelOrderSlackDeliverySummary_(delivery));
  return delivery;
}

function formatPanelMissingWorkshopNoteWarningLine_(entry) {
  entry = entry || {};
  var num = normalizeCell_(entry.rpNum) || "?";
  var factory = normalizeCell_(entry.factory) || "?";
  var urgency = normalizeCell_(entry.urgency) || "Standard";
  var status = normalizeCell_(entry.status) || "—";
  return "• *" + num + "* (" + factory + ", " + urgency + ", " + status + ")";
}

function buildPanelMissingWorkshopNoteWarningText_(entries, headline) {
  var lines = [headline];
  for (var i = 0; i < (entries || []).length; i++) {
    lines.push(formatPanelMissingWorkshopNoteWarningLine_(entries[i]));
  }
  lines.push("");
  lines.push("Моля, попълнете *Бележка Цех* (колона AD на Rep.Parts26 / колона T на Internal Production).");
  return lines.join("\n");
}

function getStandardMissingWorkshopNoteWarnKey_(entry) {
  entry = entry || {};
  return PANEL_MISSING_WORKSHOP_NOTE_WARN_KEY_PREFIX_ +
    String(entry.recordType || "rp").toLowerCase() + "_" +
    normalizeRpKeyForLookup_(entry.rpNum);
}

function wasStandardMissingWorkshopNoteWarned_(entry) {
  return !!PropertiesService.getScriptProperties().getProperty(getStandardMissingWorkshopNoteWarnKey_(entry));
}

function markStandardMissingWorkshopNoteWarned_(entry) {
  PropertiesService.getScriptProperties().setProperty(
    getStandardMissingWorkshopNoteWarnKey_(entry),
    String(Date.now())
  );
}

function filterStandardMissingWorkshopNoteNotYetWarned_(entries) {
  var out = [];
  for (var i = 0; i < (entries || []).length; i++) {
    if (!wasStandardMissingWorkshopNoteWarned_(entries[i])) out.push(entries[i]);
  }
  return out;
}

/**
 * Urgent KAZ + VAR panels without Бележка Цех — notify Boyan + Kalin.
 * Called on each 2-hour urgent sweep (business hours).
 */
function processUrgentPanelsMissingWorkshopNoteWarnings_() {
  var entries = collectPanelsMissingWorkshopNote_("urgent", { minAgeMs: 0 });
  if (!entries.length) {
    return "Urgent missing workshop note: none.";
  }
  var text = buildPanelMissingWorkshopNoteWarningText_(
    entries,
    "⚠️ *Липсва Бележка Цех* — *Urgent* панели (KAZ / VAR):"
  );
  var delivery = postPanelOrderSlackTextToRecipients_("workshop_note_warn", text);
  var summary = "Urgent missing workshop note: notified " + entries.length + " panel(s). " +
    formatPanelOrderSlackDeliverySummary_(delivery);
  Logger.log("processUrgentPanelsMissingWorkshopNoteWarnings_: " + summary);
  return summary;
}

/**
 * Standard KAZ + VAR panels without Бележка Цех, 1+ day after entry — notify Boyan + Kalin once each.
 * Daily trigger (see installKazPanelOrderSlackTriggers).
 */
function processStandardPanelsMissingWorkshopNoteWarningsDaily() {
  if (!isKazPanelOrderBusinessHours_()) {
    return "Skipped: outside business hours.";
  }
  return pushStandardPanelsMissingWorkshopNoteWarnings_({ manual: false });
}

function pushStandardPanelsMissingWorkshopNoteWarnings_(options) {
  options = options || {};
  var minAgeMs = typeof PANEL_MISSING_WORKSHOP_NOTE_STANDARD_MIN_AGE_MS_ === "number"
    ? PANEL_MISSING_WORKSHOP_NOTE_STANDARD_MIN_AGE_MS_
    : (24 * 60 * 60 * 1000);
  var entries = collectPanelsMissingWorkshopNote_("standard", { minAgeMs: minAgeMs });
  var toNotify = filterStandardMissingWorkshopNoteNotYetWarned_(entries);
  if (!toNotify.length) {
    return "Standard missing workshop note: none to notify.";
  }
  var text = buildPanelMissingWorkshopNoteWarningText_(
    toNotify,
    options.manual
      ? "⚠️ *Липсва Бележка Цех* — *Standard* панели (ръчна проверка, 1+ ден, KAZ / VAR):"
      : "⚠️ *Липсва Бележка Цех* — *Standard* панели (въведени преди 1+ ден, KAZ / VAR):"
  );
  var delivery = postPanelOrderSlackTextToRecipients_("workshop_note_warn", text);
  for (var i = 0; i < toNotify.length; i++) {
    markStandardMissingWorkshopNoteWarned_(toNotify[i]);
  }
  var summary = "Standard missing workshop note: notified " + toNotify.length + " panel(s). " +
    formatPanelOrderSlackDeliverySummary_(delivery);
  Logger.log("pushStandardPanelsMissingWorkshopNoteWarnings_: " + summary);
  return summary;
}

function uploadPanelOrderPdfToSlackRecipients_(recipientKind, pdfBlob, fileName, initialComment) {
  var userIds = resolvePanelOrderSlackRecipientUserIds_(recipientKind);
  var channelIds = [];
  var slackFileIds = [];
  for (var i = 0; i < userIds.length; i++) {
    var dmChannelId = openPanelOrderSlackDmChannelForUser_(userIds[i]);
    var uploadJson = uploadPanelOrderPdfToSlack_(dmChannelId, pdfBlob, fileName, initialComment);
    channelIds.push(dmChannelId);
    var fileId = uploadJson.file && uploadJson.file.id ? uploadJson.file.id : "";
    slackFileIds.push(fileId);
  }
  var delivery = {
    ok: true,
    recipientKind: recipientKind,
    recipientUserIds: userIds.slice(),
    channelIds: channelIds,
    channelId: channelIds.join(","),
    fileName: fileName,
    slackFileId: slackFileIds.join(",")
  };
  Logger.log("uploadPanelOrderPdfToSlackRecipients_: " + formatPanelOrderSlackDeliverySummary_(delivery));
  return delivery;
}

function parsePanelOrderSlackApiJson_(response) {
  var text = response && response.getContentText ? response.getContentText() : "";
  if (!text) return { ok: false, error: "empty_response" };
  try {
    return JSON.parse(text);
  } catch (e) {
    return { ok: false, error: text };
  }
}

function throwPanelOrderSlackApiError_(step, json) {
  var err = (json && json.error) || "unknown_error";
  var detail = "";
  if (json && json.response_metadata && json.response_metadata.messages && json.response_metadata.messages.length) {
    detail = " — " + json.response_metadata.messages.join("; ");
  }
  if (err === "missing_scope") {
    throw new Error(
      "Slack " + step + " failed: missing_scope. Add Bot Token Scope files:write, " +
      "reinstall the app to the workspace, then retry." + detail
    );
  }
  throw new Error("Slack " + step + " failed: " + err + detail);
}

function callPanelOrderSlackFormApi_(method, payload) {
  if (typeof resolveUrpsBotToken_ !== "function") {
    throw new Error("resolveUrpsBotToken_ is not available (RPSlackBot.js must be in the project).");
  }
  var token = resolveUrpsBotToken_();
  var formPayload = {};
  var keys = Object.keys(payload || {});
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var val = payload[key];
    if (val === undefined || val === null || val === "") continue;
    formPayload[key] = String(val);
  }
  var response = UrlFetchApp.fetch("https://slack.com/api/" + method, {
    method: "post",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
    payload: formPayload
  });
  return parsePanelOrderSlackApiJson_(response);
}

function sanitizePanelOrderSlackFileName_(fileName) {
  fileName = normalizeCell_(fileName) || "panel-export.pdf";
  fileName = fileName.replace(/[^\w.\-()+ ]+/g, "_");
  if (!/\.pdf$/i.test(fileName)) fileName += ".pdf";
  return fileName;
}

function uploadPanelOrderPdfToSlack_(channelId, pdfBlob, fileName, initialComment) {
  if (typeof resolveUrpsBotToken_ !== "function") {
    throw new Error("resolveUrpsBotToken_ is not available (RPSlackBot.js must be in the project).");
  }
  fileName = sanitizePanelOrderSlackFileName_(fileName);
  channelId = normalizeCell_(channelId);
  if (!channelId) throw new Error("Slack upload failed: missing channel_id.");

  var fileBytes = pdfBlob.getBytes();
  var fileLength = fileBytes.length;
  if (!fileLength) throw new Error("Slack upload failed: empty PDF.");

  var getUrlJson = callPanelOrderSlackFormApi_("files.getUploadURLExternal", {
    filename: fileName,
    length: fileLength
  });
  if (!getUrlJson.ok) throwPanelOrderSlackApiError_("files.getUploadURLExternal", getUrlJson);

  var uploadUrl = getUrlJson.upload_url;
  var fileId = getUrlJson.file_id;
  if (!uploadUrl || !fileId) {
    throw new Error("Slack files.getUploadURLExternal returned no upload_url or file_id.");
  }

  var uploadResp = UrlFetchApp.fetch(uploadUrl, {
    method: "post",
    payload: {
      filename: fileName,
      file: Utilities.newBlob(fileBytes, "application/pdf", fileName)
    },
    muteHttpExceptions: true
  });
  var uploadCode = uploadResp.getResponseCode();
  if (uploadCode < 200 || uploadCode >= 300) {
    throw new Error("Slack external file upload failed: HTTP " + uploadCode);
  }

  var completePayload = {
    files: JSON.stringify([{ id: fileId, title: fileName }]),
    channel_id: channelId
  };
  if (normalizeCell_(initialComment)) {
    completePayload.initial_comment = String(initialComment);
  }
  var completeJson = callPanelOrderSlackFormApi_("files.completeUploadExternal", completePayload);
  if (!completeJson.ok) throwPanelOrderSlackApiError_("files.completeUploadExternal", completeJson);

  var returnedFileId = fileId;
  if (completeJson.files && completeJson.files.length && completeJson.files[0].id) {
    returnedFileId = completeJson.files[0].id;
  }
  return {
    ok: true,
    file: { id: returnedFileId }
  };
}

function buildKazPanelReadyShippedWarningLines_(entries) {
  var ready = [];
  var shipped = [];
  for (var i = 0; i < (entries || []).length; i++) {
    var entry = entries[i] || {};
    var num = normalizeCell_(entry.rpNum) || "?";
    var token = normalizeStatusToken_(entry.status);
    if (token === "ready") ready.push(num);
    else if (token === "shipped") shipped.push(num);
  }
  if (!ready.length && !shipped.length) return [];

  var lines = [
    "⚠️ *Внимание — проверете статуса:* Нормалният workflow е панелите да са *Active* преди изпращане на поръчка."
  ];
  if (ready.length) lines.push("• *Ready:* " + ready.join(", "));
  if (shipped.length) lines.push("• *Shipped:* " + shipped.join(", "));
  return lines;
}

function postKazPanelOrderSlackPdf_(entries, fileNamePrefix, messageLines, recipientKind) {
  var built = buildKazPanelOrderPdfForAutomation_(entries, fileNamePrefix);
  if (!built.ok) return built;

  var nums = built.exportNums.join(", ");
  var commentParts = (messageLines || []).slice();
  var warningLines = buildKazPanelReadyShippedWarningLines_(entries);
  if (warningLines.length) commentParts = commentParts.concat(warningLines);
  var comment = commentParts.join("\n");
  if (nums) comment += (comment ? "\n\n" : "") + "Панели: " + nums;

  var delivery = uploadPanelOrderPdfToSlackRecipients_(recipientKind, built.blob, built.fileName, comment);
  markKazPanelOrdersSent_(built.entries);
  return {
    ok: true,
    sentCount: built.exportRowCount,
    exportNums: built.exportNums,
    fileName: built.fileName,
    slackDelivery: delivery,
    deliverySummary: formatPanelOrderSlackDeliverySummary_(delivery)
  };
}

function pushKazPanelOrdersToSlack_(options) {
  options = options || {};
  var urgencyMode = options.urgencyMode || "standard";
  var entries = collectKazPanelsForOrderAutomation_(urgencyMode);
  if (!entries.length) {
    var msg = "No KAZ panels pending order export (mode: " + urgencyMode + "). Run diagnosePanelOrderAutomation_('KAZ', '" + urgencyMode + "') for details.";
    Logger.log("pushKazPanelOrdersToSlack_: " + msg);
    return msg;
  }

  var messageLines;
  if (options.manual) {
    messageLines = urgencyMode === "standard"
      ? ["Резервни Части KAZ — *Standard* (ръчно изпращане)"]
      : ["Резервни Части KAZ — (ръчно изпращане)"];
  } else {
    messageLines = ["Резервни Части KAZ — *Standard* (седмична поръчка)"];
  }

  var filePrefix = urgencyMode === "standard" ? "KAZ-Standard-Panels" : "KAZ-Panels";
  var result = postKazPanelOrderSlackPdf_(entries, filePrefix, messageLines, "standard");
  if (!result.ok) {
    var failMsg = "Failed: " + result.message;
    Logger.log("pushKazPanelOrdersToSlack_: " + failMsg);
    return failMsg;
  }
  var okMsg = "Sent " + result.sentCount + " KAZ panel(s): " + result.exportNums.join(", ") +
    ". " + (result.deliverySummary || "");
  Logger.log("pushKazPanelOrdersToSlack_: " + okMsg);
  return okMsg;
}

function pushStandardKazPanelOrdersToSlack_(options) {
  options = options || {};
  return pushKazPanelOrdersToSlack_({
    manual: !!options.manual,
    urgencyMode: "standard"
  });
}

/**
 * Weekly: all Standard KAZ panels with AE/U empty — Active, Ready, or Shipped.
 * Runs Monday 09:00 (script timezone) via installKazPanelOrderSlackTriggers().
 */
function sendWeeklyStandardKazPanelOrdersToSlack() {
  if (!isKazPanelOrderBusinessHours_()) {
    Logger.log("sendWeeklyStandardKazPanelOrdersToSlack: skipped (outside business hours).");
    return "Skipped: outside business hours.";
  }
  return pushStandardKazPanelOrdersToSlack_({ manual: false });
}

/**
 * Every 2 hours (business hours): send each pending Urgent KAZ panel (one PDF per panel).
 * Includes Active, Ready, or Shipped when AE/U is empty (not yet sent).
 */
function processDelayedUrgentKazPanelOrdersToSlack() {
  if (!isKazPanelOrderBusinessHours_()) return "Skipped: outside business hours.";

  var warnSummary = "";
  try {
    warnSummary = processUrgentPanelsMissingWorkshopNoteWarnings_();
  } catch (warnErr) {
    warnSummary = "Urgent missing workshop note warning failed: " +
      (warnErr && warnErr.message ? warnErr.message : warnErr);
    Logger.log(warnSummary);
  }

  var entries = collectKazPanelsForOrderAutomation_("urgent");
  if (!entries.length) {
    return warnSummary + " | No urgent KAZ panels pending order export.";
  }

  var sent = 0;
  var errors = [];
  var deliveries = [];

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    try {
      var num = normalizeCell_(entry.rpNum) || "?";
      var result = postKazPanelOrderSlackPdf_(
        [entry],
        "KAZ-Urgent-" + num.replace(/[^\w-]+/g, ""),
        [
          "Резервни Части KAZ — *Urgent*",
          "Панел: *" + num + "*"
        ],
        "urgent"
      );
      if (result.ok) {
        sent++;
        if (result.deliverySummary) deliveries.push(num + " → " + result.deliverySummary);
      } else {
        errors.push(num + ": " + result.message);
      }
    } catch (err) {
      errors.push((entry.rpNum || "?") + ": " + (err && err.message ? err.message : err));
    }
  }

  var summary = warnSummary + " | Urgent KAZ panel Slack export: sent=" + sent;
  if (deliveries.length) summary += " | " + deliveries.join(" | ");
  if (errors.length) summary += ", errors=" + errors.join(" | ");
  Logger.log(summary);
  return summary;
}

/** One-time: install Monday 09:00 weekly + 2-hour urgent sweep + daily workshop-note warnings. */
function installKazPanelOrderSlackTriggers() {
  uninstallKazPanelOrderSlackTriggers_();
  ScriptApp.newTrigger("sendWeeklyStandardKazPanelOrdersToSlack")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
  var sweepHours = Number(KAZ_PANEL_ORDER_SLACK_CONFIG.URGENT_SWEEP_HOURS);
  if (isNaN(sweepHours) || sweepHours < 1) sweepHours = 2;
  ScriptApp.newTrigger("processDelayedUrgentKazPanelOrdersToSlack")
    .timeBased()
    .everyHours(sweepHours)
    .create();
  var dailyHour = Number(KAZ_PANEL_ORDER_SLACK_CONFIG.STANDARD_MISSING_WORKSHOP_NOTE_DAILY_HOUR);
  if (isNaN(dailyHour) || dailyHour < 0 || dailyHour > 23) dailyHour = 10;
  ScriptApp.newTrigger("processStandardPanelsMissingWorkshopNoteWarningsDaily")
    .timeBased()
    .everyDays(1)
    .atHour(dailyHour)
    .create();
  Logger.log("installKazPanelOrderSlackTriggers: installed weekly + " + sweepHours +
    "-hour urgent + daily standard workshop-note warning triggers.");
  return "KAZ panel order Slack triggers installed.";
}

function uninstallKazPanelOrderSlackTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "sendWeeklyStandardKazPanelOrdersToSlack" ||
        fn === "processDelayedUrgentKazPanelOrdersToSlack" ||
        fn === "processStandardPanelsMissingWorkshopNoteWarningsDaily") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/** Manual push: all pending KAZ panels (Standard + Urgent) — one PDF, ignores business hours. */
function manualPushPendingKazPanelOrdersToSlack() {
  return pushKazPanelOrdersToSlack_({ manual: true, urgencyMode: "all" });
}

/** Manual test: urgent missing Бележка Цех warning (Boyan + Kalin). */
function testUrgentPanelsMissingWorkshopNoteWarnings() {
  return processUrgentPanelsMissingWorkshopNoteWarnings_();
}

/** Manual test: standard missing Бележка Цех warning (1+ day, not yet warned). */
function testStandardPanelsMissingWorkshopNoteWarnings() {
  return pushStandardPanelsMissingWorkshopNoteWarnings_({ manual: true });
}
