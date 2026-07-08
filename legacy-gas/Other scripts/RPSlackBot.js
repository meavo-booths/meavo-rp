/** RP Slack bot: urgent parts/panel status posts (new message on each status change) + ready/pallet logistics pings. */

var URGENT_PARTS_SLACK_CONFIG = {
  TARGET_SHEET: "Rep.Parts26",
  INTERNAL_PRODUCTION_SHEET: "Internal Production",
  /** Nikolay (AKS panels): direct DM when a new RP/IP appears on his dashboard. */
  NIKOLAY_AKS_PANEL_DM_USER_ID: "U0920BXJVMG",
  /** Instant DM when an urgent part is logged without a factory assigned (column V empty). */
  URGENT_PART_FACTORY_DM_INSTANT_USER_ID: "U01KQQ1NQMB",
  /** Reminder DM when an urgent part has gone >1h without a factory (run by the sweep trigger). */
  URGENT_PART_FACTORY_DM_DELAYED_USER_ID: "U09FR79K2CB",
  /** How long after entry the delayed DM is allowed to fire (hours). */
  URGENT_PART_FACTORY_DM_DELAYED_AFTER_HOURS: 1,
  /**
   * Same user IDs receive the end-of-working-day digest (see daily triggers below):
   * 3pm — summary of all PARTS/STOCK rows with no factory; 4pm — reminder if any still open.
   */
  DAILY_MISSING_FACTORY_DIGEST_HOUR: 15,
  DAILY_MISSING_FACTORY_REMINDER_HOUR: 16,
  // Reuses the same bot token as UnbriefedUrgentPanelSlackBot.js when available.
  BOT_TOKEN_FALLBACK: "xoxb-1655837085858-11105893018084-K923btgoqrxwjYHESXno3ydY",
  /** Urgent parts: new channel message per status change; other column edits only if snapshot text changes. */
  SLACK_CHANNEL_ID: "C0B2MLZRP2T",
  /**
   * Ready + Pallet/Container one-shot logistics ping (assign pallet/container + address).
   * Always posts here so logistics has a dedicated channel separate from urgent RP threads.
   */
  STANDARD_READY_PALLET_CONTAINER_CHANNEL_ID: "C0B36PBQQP6",

  // Only run for edits that touch these columns:
  // A, C, G, I, J, K, L, M, Q, R, S, W, X, Y
  WATCHED_COLUMNS: { 1: true, 3: true, 7: true, 9: true, 10: true, 11: true, 12: true, 13: true, 17: true, 18: true, 19: true, 22: true, 23: true, 24: true, 25: true },

  /**
   * Column K values treated as spare parts / stock lines (Slack copy labelled "Part").
   * Other values (e.g. Panel) are treated as panel lines.
   */
  PART_ITEM_VALUES: { PART: true, PARTS: true, SPARE: true, STOCK: true, "OTHER PARTS": true }
};

/** Internal Production columns for Nikolay IP DM (A–S). */
var INTERNAL_PRODUCTION_SLACK_COL = {
  IP_NUM: 1,
  DEADLINE: 3,
  REASON: 5,
  URGENCY: 6,
  MODEL: 7,
  BATCH: 8,
  COLOUR: 9,
  PANEL: 10,
  NOTES: 12,
  WAREHOUSE: 13,
  FACTORY: 14,
  STATUS: 16,
  SOURCE_RP: 19
};

var URGENT_PARTS_COL = {
  RP_NUM: 1,         // A
  ENTRY_DATE: 2,     // B
  EST_PROD_DATE: 3,  // C
  URGENCY: 7,        // G
  MODEL: 8,          // H
  BOOTH_ID: 9,       // I
  COLOR: 10,         // J
  ITEM_VALUE: 11,    // K
  REVIEW_GROUP: 22,  // V
  QTY: 12,           // L
  DESC: 13,          // M
  NOTES: 15,         // O
  CLIENT: 17,        // Q
  ADDRESS: 18,       // R
  RECIPIENT: 19,     // S
  SHIP_METHOD: 23,   // W
  STATUS: 24,        // X
  TRACKING: 25       // Y
};

/**
 * Factory deadline overdue DMs (column C = deadline, column V = factory).
 * Install daily trigger with createFactoryDeadlineSlackTrigger().
 */
var FACTORY_DEADLINE_SLACK_CONFIG = {
  SENT_KEY_PREFIX: "FDL_",
  /** Daily sweep time in the script timezone (Mon–Fri only). */
  DAILY_SWEEP_HOUR: 10,
  DAILY_SWEEP_MINUTE: 30,
  FACTORY_ALIASES: { VS: "VAR", AS: "AKS", KS: "KAZ" },
  /** Slack user ID → display name (for config readability). */
  SLACK_USER_NAMES: {
    U0920BXJVMG: "Nikolay",
    U06U9A2FC79: "Stefan",
    U08ASTEPQ9G: "Ivan",
    U06T0MES8S2: "Yavor",
    U09FR79K2CB: "Boyan",
    U01KQQ1NQMB: "Kalin"
  },
  /** Column X statuses that stop overdue deadline DMs (case-insensitive). */
  EXCLUDED_STATUSES: {
    SHIPPED: true,
    CANCELLED: true,
    READY: true,
    SUPPLY: true
  },
  /**
   * Lead rule: daysBefore + includeDeadlineDay + repeatAfterDeadline (messageLocale optional).
   * Legacy rule: startDaysOverdue + repeatDays (e.g. 1 day after deadline, every 2 days).
   */
  FACTORY_RULES: {
    AKS: [
      {
        id: "panel_lead_deadline_bg",
        itemFilter: "panels",
        daysBefore: 2,
        includeDeadlineDay: true,
        repeatAfterDeadline: true,
        repeatDaysAfterDeadline: 1,
        messageLocale: "bg",
        userIds: ["U0920BXJVMG"] // Nikolay
      },
      {
        id: "all_one_day_after",
        itemFilter: "all",
        startDaysOverdue: 1,
        repeatDays: 2,
        userIds: ["U08ASTEPQ9G", "U06T0MES8S2", "U09FR79K2CB"] // Ivan, Yavor, Boyan
      }
    ],
    KAZ: [
      {
        id: "all_lead_deadline_bg",
        itemFilter: "all",
        daysBefore: 2,
        includeDeadlineDay: true,
        repeatAfterDeadline: true,
        repeatDaysAfterDeadline: 1,
        messageLocale: "bg",
        userIds: ["U06U9A2FC79"] // Stefan
      },
      {
        id: "all_one_day_after",
        itemFilter: "all",
        startDaysOverdue: 1,
        repeatDays: 2,
        userIds: ["U01KQQ1NQMB", "U06T0MES8S2", "U09FR79K2CB"] // Kalin, Yavor, Boyan
      }
    ],
    VAR: [
      {
        id: "all_deadline_day",
        itemFilter: "all",
        startDaysOverdue: 0,
        repeatDays: 2,
        userIds: ["U06T0MES8S2", "U09FR79K2CB", "U08ASTEPQ9G"] // Yavor, Boyan, Ivan
      }
    ]
  }
};

/**
 * Installable trigger handler (do NOT rename to onEdit).
 * Create trigger with createUrgentPartsSlackEditTrigger().
 */
function handleUrgentPartsSlackOnEdit(e) {
  if (!e || !e.range || !e.source) return;
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();

  if (sheetName === URGENT_PARTS_SLACK_CONFIG.INTERNAL_PRODUCTION_SHEET) {
    if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;
    if (e.range.getRow() <= 1) return;
    var ipRowValues = sheet
      .getRange(e.range.getRow(), 1, 1, INTERNAL_PRODUCTION_SLACK_COL.SOURCE_RP)
      .getDisplayValues()[0];
    maybeNotifyNikolayAksPanelNewEntryDmForIp_(ipRowValues);
    return;
  }

  if (sheetName !== URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET) return;
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

  var editedColumn = e.range.getColumn();
  if (!URGENT_PARTS_SLACK_CONFIG.WATCHED_COLUMNS[editedColumn]) return;

  var row = e.range.getRow();
  if (row <= 1) return;

  processUrgentPartsSlackForRow_(sheet, row, e);
}

/**
 * Manual utility: reprocess one row on demand.
 */
function syncUrgentPartsSlackForRow(row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET);
  if (!sheet) throw new Error('Sheet "' + URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET + '" not found.');
  var rowNum = Number(row) || 0;
  if (rowNum <= 1) throw new Error("Row number must be > 1.");
  processUrgentPartsSlackForRow_(sheet, rowNum, null);
}

/**
 * One-time setup: create installable edit trigger.
 */
function createUrgentPartsSlackEditTrigger() {
  ScriptApp.newTrigger("handleUrgentPartsSlackOnEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}

/**
 * Cleanup utility: delete only this bot's triggers (including legacy urgent-panel handler name).
 */
function deleteUrgentPartsSlackEditTriggers() {
  var handlers = { handleUrgentPartsSlackOnEdit: true, handleUrgentPanelSlackOnEdit: true };
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (handlers[triggers[i].getHandlerFunction()]) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function processUrgentPartsSlackForRow_(sheet, row, editEvent) {
  var channelId = normUrps_(URGENT_PARTS_SLACK_CONFIG.SLACK_CHANNEL_ID);
  if (!channelId) throw new Error("Missing SLACK_CHANNEL_ID in URGENT_PARTS_SLACK_CONFIG.");

  var rowValues = sheet.getRange(row, 1, 1, 25).getDisplayValues()[0];
  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  if (!rpNum) return;

  var urgency = normUrps_(rowValues[URGENT_PARTS_COL.URGENCY - 1]).toLowerCase();
  if (urgency === "urgent") {
    var statusRaw = normUrps_(rowValues[URGENT_PARTS_COL.STATUS - 1]);
    var statusUpper = statusRaw.toUpperCase();
    var messageText = buildUrgentPartsSlackMessage_(rowValues, statusRaw, statusUpper);

    var props = PropertiesService.getScriptProperties();
    var hashKey = getUrpsHashKey_(rpNum);
    var legacyTsKey = "UPS_TS_" + rpNum;
    var newHash = hashUrps_(messageText);
    var oldHash = normUrps_(props.getProperty(hashKey));
    var isStatusEdit =
      editEvent && editEvent.range && editEvent.range.getColumn() === URGENT_PARTS_COL.STATUS;

    var contentUnchanged = !!(newHash && oldHash && newHash === oldHash);
    if (!isStatusEdit && contentUnchanged) {
      // Avoid duplicate posts when a non-status cell is saved without changing the Slack snapshot.
    } else {
      try {
        var postResp = callSlackApiUrps_("chat.postMessage", {
          channel: channelId,
          text: messageText
        });
        var postJson = parseSlackJsonUrps_(postResp);
        if (!postJson.ok || !postJson.ts) {
          Logger.log("chat.postMessage failed: " + (postJson.error || "unknown_error"));
        } else {
          props.deleteProperty(legacyTsKey);
          if (newHash) props.setProperty(hashKey, newHash);
        }
      } catch (err) {
        Logger.log("Urgent parts Slack thread sync failed: " + err);
      }
    }
  }

  if (isLeavingReadyStatusEditUrps_(editEvent) || isEnteringReadyStatusEditUrps_(editEvent)) {
    clearUrpsPalletReadySentFlag_(rpNum);
  }

  maybeNotifyReadyPalletContainerShipment_(sheet, row, rpNum, editEvent);
  maybeNotifyNikolayAksPanelNewEntryDmForRp_(rowValues);
  maybeNotifyUrgentPartFactoryAssignNeededInstantDm_(rowValues);

  if (editEvent && editEvent.range && editEvent.range.getColumn() === URGENT_PARTS_COL.STATUS) {
    if (typeof syncReadyDateColumnZ_ === "function") {
      syncReadyDateColumnZ_(sheet, row, editEvent.value, editEvent.oldValue);
    }
    if (isLeavingReadyStatusEditUrps_(editEvent)) {
      try {
        notifyShippingSlackNoLongerReady_(sheet, row, editEvent.value);
      } catch (shipErr) {
        Logger.log("processUrgentPartsSlackForRow_ shipping not-ready Slack: " + shipErr);
      }
    }
  }
}

function isPartLikeUrgentItem_(itemUpper) {
  return !!(URGENT_PARTS_SLACK_CONFIG.PART_ITEM_VALUES[itemUpper]);
}

function getNikolaySlackReviewerConfig_() {
  if (typeof getReviewerDashboardConfig_ === "function") {
    return getReviewerDashboardConfig_("nikolay@meavo.com");
  }
  return {
    allowedReviewGroups: ["AKS"],
    allowAllItemTypes: true,
    excludedItemTypes: ["PART", "PARTS", "STOCK", "SPARE"]
  };
}

function isNikolayAksPanelRpRow_(rowValues) {
  var itemType = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]);
  var reviewGroup = normUrps_(rowValues[URGENT_PARTS_COL.REVIEW_GROUP - 1]);
  if (typeof isReviewerDashboardEligibleRow_ === "function") {
    return isReviewerDashboardEligibleRow_(itemType, reviewGroup, getNikolaySlackReviewerConfig_());
  }
  return false;
}

function isNikolayAksPanelIpRow_(rowValues) {
  if (typeof isInternalProductionRowPopulated_ === "function") {
    if (!isInternalProductionRowPopulated_(rowValues)) return false;
  } else if (!normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.IP_NUM - 1])) {
    return false;
  }
  var panel = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.PANEL - 1]);
  if (typeof isReviewerDashboardEligibleRow_ === "function") {
    var factory = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.FACTORY - 1]);
    return isReviewerDashboardEligibleRow_(panel, factory, getNikolaySlackReviewerConfig_());
  }
  return false;
}

function getNikolayAksDmSentKey_(kind, recordNum) {
  return "NIKOLAY_AKS_DM_" + String(kind || "").toUpperCase() + "_" + normUrps_(recordNum);
}

function openSlackDmChannelUrps_(userId) {
  var token = resolveUrpsBotToken_();
  var response = UrlFetchApp.fetch("https://slack.com/api/conversations.open", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ users: userId }),
    muteHttpExceptions: true
  });
  var json = parseSlackJsonUrps_(response);
  if (!json.ok || !json.channel || !json.channel.id) {
    throw new Error("Slack conversations.open failed: " + (json.error || "unknown_error"));
  }
  return json.channel.id;
}

/** Post a plain-text DM to a Slack user ID (opens IM channel then chat.postMessage). */
function postUrpsDmToUser_(userId, text) {
  var safeUser = normUrps_(userId);
  if (!safeUser) return;
  var dmChannelId = openSlackDmChannelUrps_(safeUser);
  var postResp = callSlackApiUrps_("chat.postMessage", {
    channel: dmChannelId,
    text: String(text || "")
  });
  var postJson = parseSlackJsonUrps_(postResp);
  if (!postJson.ok) {
    throw new Error("DM chat.postMessage failed: " + (postJson.error || "unknown_error"));
  }
}

function postNikolayAksPanelDm_(text) {
  var userId = normUrps_(URGENT_PARTS_SLACK_CONFIG.NIKOLAY_AKS_PANEL_DM_USER_ID);
  if (!userId) return;
  var dmChannelId = openSlackDmChannelUrps_(userId);
  var postResp = callSlackApiUrps_("chat.postMessage", {
    channel: dmChannelId,
    text: text
  });
  var postJson = parseSlackJsonUrps_(postResp);
  if (!postJson.ok) {
    throw new Error("Nikolay DM chat.postMessage failed: " + (postJson.error || "unknown_error"));
  }
}

function buildNikolayAksNewEntryDmMessageForRp_(rowValues) {
  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  var urgency = normUrps_(rowValues[URGENT_PARTS_COL.URGENCY - 1]) || "—";
  var model = normUrps_(rowValues[URGENT_PARTS_COL.MODEL - 1]);
  var boothId = normUrps_(rowValues[URGENT_PARTS_COL.BOOTH_ID - 1]);
  var color = normUrps_(rowValues[URGENT_PARTS_COL.COLOR - 1]);
  var panel = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]);
  var qty = normUrps_(rowValues[URGENT_PARTS_COL.QTY - 1]);
  var desc = normUrps_(rowValues[URGENT_PARTS_COL.DESC - 1]);
  var client = normUrps_(rowValues[URGENT_PARTS_COL.CLIENT - 1]);
  var due = normUrps_(rowValues[URGENT_PARTS_COL.EST_PROD_DATE - 1]);
  var status = normUrps_(rowValues[URGENT_PARTS_COL.STATUS - 1]) || "—";
  var lines = [
    ":new: *New AKS panel (RP)*",
    "*RP:* " + rpNum,
    "*Urgency:* " + urgency,
    "*Panel:* " + panel
  ];
  if (model) lines.push("*Model:* " + model);
  if (boothId) lines.push("*Booth:* " + boothId);
  if (color) lines.push("*Colour:* " + color);
  if (qty || desc) lines.push("*Item detail:* " + (qty ? qty + " x " : "") + (desc || "—"));
  if (client) lines.push("*Client:* " + client);
  if (due) lines.push("*Deadline:* " + due);
  lines.push("*Status:* " + status);
  return lines.join("\n");
}

function buildNikolayAksNewEntryDmMessageForIp_(rowValues) {
  var ipNum = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.IP_NUM - 1]);
  var lines = [
    ":new: *New AKS internal production (IP)*",
    "*IP:* " + ipNum,
    "*Urgency:* " + (normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.URGENCY - 1]) || "Standard"),
    "*Panel:* " + (normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.PANEL - 1]) || "—")
  ];
  var model = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.MODEL - 1]);
  var batch = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.BATCH - 1]);
  var colour = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.COLOUR - 1]);
  var warehouse = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.WAREHOUSE - 1]);
  var sourceRp = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.SOURCE_RP - 1]);
  var due = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.DEADLINE - 1]);
  var reason = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.REASON - 1]);
  var status = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.STATUS - 1]) || "—";
  if (model) lines.push("*Model:* " + model);
  if (batch) lines.push("*Batch:* " + batch);
  if (colour) lines.push("*Colour:* " + colour);
  if (warehouse) lines.push("*Warehouse:* " + warehouse);
  if (sourceRp) lines.push("*Source RP:* " + sourceRp);
  if (reason) lines.push("*Reason:* " + reason);
  if (due) lines.push("*Deadline:* " + due);
  lines.push("*Status:* " + status);
  return lines.join("\n");
}

function maybeNotifyNikolayAksPanelNewEntryDmForRp_(rowValues) {
  try {
    if (!isNikolayAksPanelRpRow_(rowValues)) return;
    var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
    if (!rpNum) return;
    var props = PropertiesService.getScriptProperties();
    var sentKey = getNikolayAksDmSentKey_("rp", rpNum);
    if (props.getProperty(sentKey)) return;
    postNikolayAksPanelDm_(buildNikolayAksNewEntryDmMessageForRp_(rowValues));
    props.setProperty(sentKey, "1");
  } catch (err) {
    Logger.log("Nikolay AKS panel DM (RP): " + err);
  }
}

function maybeNotifyNikolayAksPanelNewEntryDmForIp_(rowValues) {
  try {
    if (!isNikolayAksPanelIpRow_(rowValues)) return;
    var ipNum = normUrps_(rowValues[INTERNAL_PRODUCTION_SLACK_COL.IP_NUM - 1]);
    if (!ipNum) return;
    var props = PropertiesService.getScriptProperties();
    var sentKey = getNikolayAksDmSentKey_("ip", ipNum);
    if (props.getProperty(sentKey)) return;
    postNikolayAksPanelDm_(buildNikolayAksNewEntryDmMessageForIp_(rowValues));
    props.setProperty(sentKey, "1");
  } catch (err) {
    Logger.log("Nikolay AKS panel DM (IP): " + err);
  }
}

/**
 * Called from WebAppLogic when a new Internal Production row is appended (Used Existing Panel).
 */
function notifyNikolayAksNewEntryFromInternalProductionRow_(rowValues) {
  maybeNotifyNikolayAksPanelNewEntryDmForIp_(rowValues);
}

/* ───────────────────────────────────────────────────────────────────────────
 * Urgent-part factory-assignment DMs
 *
 *   Instant DM (URGENT_PART_FACTORY_DM_INSTANT_USER_ID):
 *     Fires from processUrgentPartsSlackForRow_ — i.e. on RP creation through
 *     the Logger form (via safeSyncUrgentSlackForRow_), and on any watched-column
 *     edit that flips a row into the "urgent + part + no factory yet" state.
 *
 *   Delayed DM (URGENT_PART_FACTORY_DM_DELAYED_USER_ID):
 *     Fires from runUrgentPartsDelayedFactoryDmSweep — a 10-minute time-driven
 *     trigger that scans the sheet and DMs once per RP if the row has been
 *     "urgent + part + no factory" for more than URGENT_PART_FACTORY_DM_DELAYED_AFTER_HOURS.
 *
 *   Both notifications are deduped per RP via Script Properties so each person
 *   is messaged at most once per RP for this state.
 *  ─────────────────────────────────────────────────────────────────────────── */

function isUrgentPartAwaitingFactoryAssignment_(rowValues) {
  if (!rowValues) return false;
  var urgency = normUrps_(rowValues[URGENT_PARTS_COL.URGENCY - 1]).toLowerCase();
  if (urgency !== "urgent") return false;
  var itemUpper = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]).toUpperCase();
  if (!isPartLikeUrgentItem_(itemUpper)) return false;
  if (normUrps_(rowValues[URGENT_PARTS_COL.REVIEW_GROUP - 1])) return false; // factory already set
  var statusUpper = normUrps_(rowValues[URGENT_PARTS_COL.STATUS - 1]).toUpperCase();
  if (statusUpper === "CANCELLED" || statusUpper === "SHIPPED") return false;
  return true;
}

function getUrgentPartFactoryDmSentKey_(kind, rpNum) {
  return "URGENT_PART_FACTORY_DM_SENT_" + String(kind || "").toUpperCase() + "_" + normUrps_(rpNum);
}

function buildUrgentPartFactoryAssignDmMessage_(rowValues, rpNum, options) {
  var opts = options || {};
  var header = opts.delayed
    ? ":warning: *Reminder* — *" + rpNum + "* is an urgent part with no factory assigned yet."
    : ":rotating_light: *New urgent part* — *" + rpNum + "* logged. Please assign to a factory.";

  var model = normUrps_(rowValues[URGENT_PARTS_COL.MODEL - 1]);
  var boothId = normUrps_(rowValues[URGENT_PARTS_COL.BOOTH_ID - 1]);
  var color = normUrps_(rowValues[URGENT_PARTS_COL.COLOR - 1]);
  var qty = normUrps_(rowValues[URGENT_PARTS_COL.QTY - 1]);
  var desc = normUrps_(rowValues[URGENT_PARTS_COL.DESC - 1]);
  var client = normUrps_(rowValues[URGENT_PARTS_COL.CLIENT - 1]);
  var due = normUrps_(rowValues[URGENT_PARTS_COL.EST_PROD_DATE - 1]);

  var lines = [header];
  if (model) lines.push("*Model:* " + model);
  if (boothId) lines.push("*Booth:* " + boothId + (color ? ", " + color : ""));
  if (qty || desc) lines.push("*Item:* " + (qty ? qty + " x " : "") + (desc || "—"));
  if (client) lines.push("*Client:* " + client);
  if (due) lines.push("*Estimated shipping date:* " + due);
  if (opts.delayed && opts.entryAgeHours != null) {
    lines.push("_Logged " + opts.entryAgeHours + "h ago and still unassigned._");
  }
  return lines.join("\n");
}

function postUrgentPartFactoryAssignDm_(userId, rowValues, rpNum, options) {
  var safeUser = normUrps_(userId);
  if (!safeUser) return;
  var dmChannelId = openSlackDmChannelUrps_(safeUser);
  var text = buildUrgentPartFactoryAssignDmMessage_(rowValues, rpNum, options);
  var postResp = callSlackApiUrps_("chat.postMessage", { channel: dmChannelId, text: text });
  var postJson = parseSlackJsonUrps_(postResp);
  if (!postJson.ok) {
    throw new Error("Urgent-part factory DM failed: " + (postJson.error || "unknown_error"));
  }
}

function maybeNotifyUrgentPartFactoryAssignNeededInstantDm_(rowValues) {
  try {
    if (!isUrgentPartAwaitingFactoryAssignment_(rowValues)) return;
    var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
    if (!rpNum) return;
    var userId = normUrps_(URGENT_PARTS_SLACK_CONFIG.URGENT_PART_FACTORY_DM_INSTANT_USER_ID);
    if (!userId) return;
    var props = PropertiesService.getScriptProperties();
    var sentKey = getUrgentPartFactoryDmSentKey_("instant", rpNum);
    if (props.getProperty(sentKey)) return;
    postUrgentPartFactoryAssignDm_(userId, rowValues, rpNum, { delayed: false });
    props.setProperty(sentKey, String(Date.now()));
  } catch (err) {
    Logger.log("Urgent-part factory DM (instant): " + err);
  }
}

/**
 * Time-driven sweep handler. Schedule with createUrgentPartsDelayedFactoryDmTrigger().
 * Fires the delayed DM for any urgent-part row that's been "no factory" longer than
 * URGENT_PART_FACTORY_DM_DELAYED_AFTER_HOURS, once per RP.
 */
function runUrgentPartsDelayedFactoryDmSweep() {
  var userId = normUrps_(URGENT_PARTS_SLACK_CONFIG.URGENT_PART_FACTORY_DM_DELAYED_USER_ID);
  if (!userId) return;

  var thresholdHours = Number(URGENT_PARTS_SLACK_CONFIG.URGENT_PART_FACTORY_DM_DELAYED_AFTER_HOURS);
  if (!thresholdHours || thresholdHours <= 0) thresholdHours = 1;
  var thresholdMs = thresholdHours * 60 * 60 * 1000;
  var nowMs = Date.now();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // raw values so column B comes back as a Date object for the age check;
  // display values so the rest of the eligibility logic matches processUrgentPartsSlackForRow_.
  var range = sheet.getRange(2, 1, lastRow - 1, 25);
  var raw = range.getValues();
  var display = range.getDisplayValues();

  var props = PropertiesService.getScriptProperties();

  for (var i = 0; i < display.length; i++) {
    var rowValues = display[i];
    var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
    if (!rpNum) continue;
    if (!isUrgentPartAwaitingFactoryAssignment_(rowValues)) continue;

    var entryRaw = raw[i][URGENT_PARTS_COL.ENTRY_DATE - 1];
    var entryMs = (entryRaw instanceof Date) ? entryRaw.getTime() : NaN;
    if (isNaN(entryMs)) continue; // missing/garbage entry date — skip
    var ageMs = nowMs - entryMs;
    if (ageMs < thresholdMs) continue;

    var sentKey = getUrgentPartFactoryDmSentKey_("delayed", rpNum);
    if (props.getProperty(sentKey)) continue;

    try {
      postUrgentPartFactoryAssignDm_(userId, rowValues, rpNum, {
        delayed: true,
        entryAgeHours: Math.floor(ageMs / (60 * 60 * 1000))
      });
      props.setProperty(sentKey, String(Date.now()));
    } catch (err) {
      Logger.log("Urgent-part factory DM (delayed) for " + rpNum + ": " + err);
    }
  }
}

/**
 * One-time setup: install a 10-minute time-driven trigger that runs the delayed sweep.
 * Safe to re-run — existing triggers for this handler are removed first.
 */
function createUrgentPartsDelayedFactoryDmTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runUrgentPartsDelayedFactoryDmSweep") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("runUrgentPartsDelayedFactoryDmSweep")
    .timeBased()
    .everyMinutes(10)
    .create();
}

/**
 * Cleanup utility: remove the delayed-DM sweep trigger (e.g. when disabling the feature).
 */
function deleteUrgentPartsDelayedFactoryDmTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runUrgentPartsDelayedFactoryDmSweep") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/** Mon–Fri in the script timezone (ISO weekday u: 1 = Monday … 7 = Sunday). */
function isUrpsWorkingWeekdayInScriptTz_(optDate) {
  var d = optDate || new Date();
  var tz = Session.getScriptTimeZone();
  var u = parseInt(Utilities.formatDate(d, tz, "u"), 10);
  if (!isNaN(u)) return u >= 1 && u <= 5;
  var day = d.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Column K is PARTS or STOCK, column V (factory / review group) empty, urgency Standard or Urgent,
 * row is still active (not Shipped / Cancelled), RP number present.
 */
function isPartsOrStockMissingFactoryRow_(rowValues) {
  if (!rowValues) return false;
  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  if (!rpNum) return false;
  var k = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]).toUpperCase();
  if (k !== "PARTS" && k !== "STOCK") return false;
  if (normUrps_(rowValues[URGENT_PARTS_COL.REVIEW_GROUP - 1])) return false;
  var statusUpper = normUrps_(rowValues[URGENT_PARTS_COL.STATUS - 1]).toUpperCase();
  if (statusUpper === "CANCELLED" || statusUpper === "SHIPPED") return false;
  var urg = normUrps_(rowValues[URGENT_PARTS_COL.URGENCY - 1]).toLowerCase();
  if (urg !== "standard" && urg !== "urgent") return false;
  return true;
}

/** @returns {{rowNum:number, rpNum:string, rowValues:string[]}[]} */
function collectPartsStockMissingFactoryRows_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var display = sheet.getRange(2, 1, lastRow - 1, 25).getDisplayValues();
  var out = [];
  for (var i = 0; i < display.length; i++) {
    var rowValues = display[i];
    if (!isPartsOrStockMissingFactoryRow_(rowValues)) continue;
    out.push({
      rowNum: i + 2,
      rpNum: normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]),
      rowValues: rowValues
    });
  }
  return out;
}

function buildDailyMissingFactoryDigestMessage_(rows) {
  var tz = Session.getScriptTimeZone();
  var dateStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  var header =
    ":clipboard: *End of working day — factory assignment digest* (`" +
    dateStr +
    "`)\n" +
    "_PARTS or STOCK (column K) with no factory (column V empty), Standard or Urgent._\n";

  if (!rows.length) {
    return header + "\n✅ _No rows awaiting factory assignment._";
  }

  var lines = [header, "", "*" + rows.length + " row(s) need a factory:*", ""];
  var maxLines = 80;
  var shown = 0;
  for (var i = 0; i < rows.length && shown < maxLines; i++) {
    var rv = rows[i].rowValues;
    var urg = normUrps_(rv[URGENT_PARTS_COL.URGENCY - 1]) || "—";
    var k = normUrps_(rv[URGENT_PARTS_COL.ITEM_VALUE - 1]) || "—";
    var model = normUrps_(rv[URGENT_PARTS_COL.MODEL - 1]);
    var client = normUrps_(rv[URGENT_PARTS_COL.CLIENT - 1]);
    var due = normUrps_(rv[URGENT_PARTS_COL.EST_PROD_DATE - 1]);
    var qty = normUrps_(rv[URGENT_PARTS_COL.QTY - 1]);
    var desc = normUrps_(rv[URGENT_PARTS_COL.DESC - 1]);
    var status = normUrps_(rv[URGENT_PARTS_COL.STATUS - 1]) || "—";
    var one =
      "• *" +
      rows[i].rpNum +
      "* (row " +
      rows[i].rowNum +
      ") · *" +
      k +
      "* · " +
      urg;
    if (model) one += " · Model: " + model;
    if (client) one += " · Client: " + client;
    if (due) one += " · ETA: " + due;
    if (qty || desc) one += "\n  _" + (qty ? qty + " × " : "") + (desc || "—") + "_";
    one += " · Status: " + status;
    lines.push(one);
    shown++;
  }
  if (rows.length > maxLines) {
    lines.push("\n_…and " + (rows.length - maxLines) + " more row(s) not listed (Slack length limit)._");
  }
  return lines.join("\n");
}

function buildDailyMissingFactoryReminderMessage_(rows) {
  var tz = Session.getScriptTimeZone();
  var dateStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  var header =
    ":warning: *4pm reminder — PARTS/STOCK still without factory* (`" +
    dateStr +
    "`)\n" +
    "_The following row(s) still have column V empty._\n";

  var lines = [header, "", "*" + rows.length + " open row(s):*", ""];
  var maxLines = 80;
  for (var i = 0; i < rows.length && i < maxLines; i++) {
    lines.push("• *" + rows[i].rpNum + "* (row " + rows[i].rowNum + ") · " + normUrps_(rows[i].rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]));
  }
  if (rows.length > maxLines) lines.push("\n_…and " + (rows.length - maxLines) + " more._");
  return lines.join("\n");
}

/**
 * 3pm (script TZ) on working days: DM instant user with full summary (including “none” message).
 * Install with createDailyMissingFactoryDigestTriggers().
 */
function runDailyMissingFactoryDigest3pm_() {
  if (!isUrpsWorkingWeekdayInScriptTz_()) return;
  var userId = normUrps_(URGENT_PARTS_SLACK_CONFIG.URGENT_PART_FACTORY_DM_INSTANT_USER_ID);
  if (!userId) return;
  var rows = collectPartsStockMissingFactoryRows_();
  try {
    postUrpsDmToUser_(userId, buildDailyMissingFactoryDigestMessage_(rows));
  } catch (err) {
    Logger.log("runDailyMissingFactoryDigest3pm_: " + err);
  }
}

/**
 * 4pm (script TZ) on working days: DM delayed user only if PARTS/STOCK rows still lack factory.
 */
function runDailyMissingFactoryReminder4pm_() {
  if (!isUrpsWorkingWeekdayInScriptTz_()) return;
  var userId = normUrps_(URGENT_PARTS_SLACK_CONFIG.URGENT_PART_FACTORY_DM_DELAYED_USER_ID);
  if (!userId) return;
  var rows = collectPartsStockMissingFactoryRows_();
  if (!rows.length) return;
  try {
    postUrpsDmToUser_(userId, buildDailyMissingFactoryReminderMessage_(rows));
  } catch (err) {
    Logger.log("runDailyMissingFactoryReminder4pm_: " + err);
  }
}

/**
 * One-time setup: daily clock triggers at 15:00 and 16:00 (project timezone) Mon–Sun;
 * handlers skip Sat/Sun. Safe to re-run — removes prior triggers for these handlers first.
 */
function createDailyMissingFactoryDigestTriggers() {
  var handlers = { runDailyMissingFactoryDigest3pm_: true, runDailyMissingFactoryReminder4pm_: true };
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (handlers[triggers[i].getHandlerFunction()]) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  var hDigest = Number(URGENT_PARTS_SLACK_CONFIG.DAILY_MISSING_FACTORY_DIGEST_HOUR);
  var hRemind = Number(URGENT_PARTS_SLACK_CONFIG.DAILY_MISSING_FACTORY_REMINDER_HOUR);
  if (isNaN(hDigest) || hDigest < 0 || hDigest > 23) hDigest = 15;
  if (isNaN(hRemind) || hRemind < 0 || hRemind > 23) hRemind = 16;

  ScriptApp.newTrigger("runDailyMissingFactoryDigest3pm_")
    .timeBased()
    .everyDays(1)
    .atHour(hDigest)
    .create();

  ScriptApp.newTrigger("runDailyMissingFactoryReminder4pm_")
    .timeBased()
    .everyDays(1)
    .atHour(hRemind)
    .create();
}

function deleteDailyMissingFactoryDigestTriggers() {
  var handlers = { runDailyMissingFactoryDigest3pm_: true, runDailyMissingFactoryReminder4pm_: true };
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (handlers[triggers[i].getHandlerFunction()]) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/* ───────────────────────────────────────────────────────────────────────────
 * Factory deadline overdue DMs (column C deadline, column V factory).
 *  ─────────────────────────────────────────────────────────────────────────── */

function getFactoryDeadlineSentKey_(factoryCode, ruleId, rpNum) {
  return (
    FACTORY_DEADLINE_SLACK_CONFIG.SENT_KEY_PREFIX +
    factoryCode +
    "_" +
    ruleId +
    "_" +
    normUrps_(rpNum)
  );
}

function normalizeFactoryCodeForDeadlineUrps_(factoryCell) {
  var upper = normUrps_(factoryCell).toUpperCase();
  if (!upper) return "";
  var aliases = FACTORY_DEADLINE_SLACK_CONFIG.FACTORY_ALIASES || {};
  if (aliases[upper]) return aliases[upper];
  if (upper === "AKS" || upper === "VAR" || upper === "KAZ") return upper;
  return "";
}

function startOfDayInScriptTzUrps_(dateObj) {
  var tz = Session.getScriptTimeZone();
  var ymd = Utilities.formatDate(dateObj, tz, "yyyy-MM-dd");
  var parts = ymd.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0, 0);
}

function todayStartInScriptTzUrps_() {
  return startOfDayInScriptTzUrps_(new Date());
}

function ymdCompactFromDateUrps_(dateObj) {
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyyMMdd");
}

function daysBetweenYmdUrps_(earlierYmd, laterYmd) {
  if (!earlierYmd || !laterYmd) return 999;
  var a =
    earlierYmd.slice(0, 4) +
    "-" +
    earlierYmd.slice(4, 6) +
    "-" +
    earlierYmd.slice(6, 8);
  var b =
    laterYmd.slice(0, 4) +
    "-" +
    laterYmd.slice(4, 6) +
    "-" +
    laterYmd.slice(6, 8);
  var startA = startOfDayInScriptTzUrps_(new Date(a));
  var startB = startOfDayInScriptTzUrps_(new Date(b));
  return Math.round((startB.getTime() - startA.getTime()) / 86400000);
}

function parseSheetDeadlineDateUrps_(rawValue, displayValue) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return startOfDayInScriptTzUrps_(rawValue);
  }
  var s = normUrps_(displayValue) || normUrps_(rawValue);
  if (!s) return null;
  var direct = new Date(s);
  if (!isNaN(direct.getTime())) return startOfDayInScriptTzUrps_(direct);
  var m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
  if (m) {
    var year = Number(m[3]);
    if (year < 100) year += 2000;
    var parsed = new Date(year, Number(m[2]) - 1, Number(m[1]), 12, 0, 0, 0);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function getDaysOverdueFromDeadlineUrps_(deadlineStart, todayStart) {
  return Math.floor((todayStart.getTime() - deadlineStart.getTime()) / 86400000);
}

function isExcludedFromFactoryDeadlineAlertUrps_(status) {
  var raw = normUrps_(status);
  if (!raw) return false;
  if (typeof isOrderedOnAmazonStatus_ === "function" && isOrderedOnAmazonStatus_(raw)) {
    return true;
  }
  if (raw.toLowerCase() === "ordered on amazon") return true;
  var excluded = FACTORY_DEADLINE_SLACK_CONFIG.EXCLUDED_STATUSES || {};
  return !!excluded[raw.toUpperCase()];
}

function isOpenForFactoryDeadlineAlertUrps_(status) {
  return !isExcludedFromFactoryDeadlineAlertUrps_(status);
}

function matchesFactoryDeadlineItemFilterUrps_(itemFilter, rowValues) {
  if (itemFilter === "panels") {
    var itemUpper = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]).toUpperCase();
    return !isPartLikeUrgentItem_(itemUpper);
  }
  return true;
}

function getFactoryDeadlineMaxLeadDays_() {
  var max = 0;
  var rulesMap = FACTORY_DEADLINE_SLACK_CONFIG.FACTORY_RULES || {};
  for (var factory in rulesMap) {
    if (!Object.prototype.hasOwnProperty.call(rulesMap, factory)) continue;
    var rules = rulesMap[factory];
    for (var i = 0; i < rules.length; i++) {
      var d = Number(rules[i].daysBefore) || 0;
      if (d > max) max = d;
    }
  }
  return max || 2;
}

function isFactoryDeadlineLeadRule_(rule) {
  return rule.daysBefore != null || rule.includeDeadlineDay || rule.repeatAfterDeadline;
}

function shouldSendFactoryDeadlineNotificationUrps_(daysOverdue, rule, lastSentYmd, todayYmd) {
  if (isFactoryDeadlineLeadRule_(rule)) {
    var eligible = false;
    var leadDays = Number(rule.daysBefore) || 0;
    if (leadDays > 0 && daysOverdue === -leadDays) eligible = true;
    if (rule.includeDeadlineDay && daysOverdue === 0) eligible = true;
    if (rule.repeatAfterDeadline && daysOverdue >= 1) eligible = true;
    if (!eligible) return false;
    if (!lastSentYmd) return true;
    if (daysOverdue <= 0) return lastSentYmd !== todayYmd;
    var repeatAfter = Number(rule.repeatDaysAfterDeadline) || 1;
    return daysBetweenYmdUrps_(lastSentYmd, todayYmd) >= repeatAfter;
  }

  if (daysOverdue < rule.startDaysOverdue) return false;
  if (!lastSentYmd) return true;
  return daysBetweenYmdUrps_(lastSentYmd, todayYmd) >= rule.repeatDays;
}

function buildFactoryDeadlineOverdueMessage_(rowValues, factoryCode, rule, daysOverdue, deadlineDisplay) {
  if (rule.messageLocale === "bg") {
    return buildFactoryDeadlineMessageBg_(rowValues, factoryCode, daysOverdue, deadlineDisplay);
  }
  return buildFactoryDeadlineMessageEn_(rowValues, factoryCode, rule, daysOverdue, deadlineDisplay);
}

function buildFactoryDeadlineMessageBg_(rowValues, factoryCode, daysOverdue, deadlineDisplay) {
  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  var itemUpper = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]).toUpperCase();
  var isPart = isPartLikeUrgentItem_(itemUpper);
  var typeWord = isPart ? "част" : "панел";
  var boothId = normUrps_(rowValues[URGENT_PARTS_COL.BOOTH_ID - 1]);
  var color = normUrps_(rowValues[URGENT_PARTS_COL.COLOR - 1]);
  var qty = normUrps_(rowValues[URGENT_PARTS_COL.QTY - 1]);
  var desc = normUrps_(rowValues[URGENT_PARTS_COL.DESC - 1]);
  var client = normUrps_(rowValues[URGENT_PARTS_COL.CLIENT - 1]);
  var status = normUrps_(rowValues[URGENT_PARTS_COL.STATUS - 1]) || "—";
  var urgency = normUrps_(rowValues[URGENT_PARTS_COL.URGENCY - 1]) || "—";

  var header;
  if (daysOverdue === -2) {
    header =
      ":warning: *Срокът изтича след 2 дни* — *" + rpNum + "* (" + factoryCode + ", " + typeWord + ")";
  } else if (daysOverdue === 0) {
    header = ":warning: *Срокът е днес* — *" + rpNum + "* (" + factoryCode + ", " + typeWord + ")";
  } else if (daysOverdue === 1) {
    header =
      ":bangbang: *1 ден след срока* — *" + rpNum + "* (" + factoryCode + ", " + typeWord + ")";
  } else {
    header =
      ":bangbang: *" +
      daysOverdue +
      " дни след срока* — *" +
      rpNum +
      "* (" +
      factoryCode +
      ", " +
      typeWord +
      ")";
  }

  var lines = [header];
  lines.push("*Спешност:* " + urgency);
  if (boothId) lines.push("*Стънд:* " + boothId + (color ? ", " + color : ""));
  if (qty || desc) lines.push("*Артикул:* " + (qty ? qty + " x " : "") + (desc || "—"));
  if (client) lines.push("*Клиент:* " + client);
  lines.push("*Срок:* " + (deadlineDisplay || "—"));
  lines.push("*Статус:* " + status);
  return lines.join("\n");
}

function buildFactoryDeadlineMessageEn_(rowValues, factoryCode, rule, daysOverdue, deadlineDisplay) {
  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  var itemUpper = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]).toUpperCase();
  var isPart = isPartLikeUrgentItem_(itemUpper);
  var typeWord = isPart ? "Part" : "Panel";
  var boothId = normUrps_(rowValues[URGENT_PARTS_COL.BOOTH_ID - 1]);
  var color = normUrps_(rowValues[URGENT_PARTS_COL.COLOR - 1]);
  var qty = normUrps_(rowValues[URGENT_PARTS_COL.QTY - 1]);
  var desc = normUrps_(rowValues[URGENT_PARTS_COL.DESC - 1]);
  var client = normUrps_(rowValues[URGENT_PARTS_COL.CLIENT - 1]);
  var status = normUrps_(rowValues[URGENT_PARTS_COL.STATUS - 1]) || "—";
  var urgency = normUrps_(rowValues[URGENT_PARTS_COL.URGENCY - 1]) || "—";

  var header;
  if (daysOverdue === 0) {
    header = ":warning: *Deadline is today* — *" + rpNum + "* (" + factoryCode + " " + typeWord + ")";
  } else if (daysOverdue === 1) {
    header = ":bangbang: *1 day past deadline* — *" + rpNum + "* (" + factoryCode + " " + typeWord + ")";
  } else {
    header =
      ":bangbang: *" +
      daysOverdue +
      " days past deadline* — *" +
      rpNum +
      "* (" +
      factoryCode +
      " " +
      typeWord +
      ")";
  }

  var lines = [header];
  lines.push("*Urgency:* " + urgency);
  if (boothId) lines.push("*Booth:* " + boothId + (color ? ", " + color : ""));
  if (qty || desc) lines.push("*Item:* " + (qty ? qty + " x " : "") + (desc || "—"));
  if (client) lines.push("*Client:* " + client);
  lines.push("*Deadline:* " + (deadlineDisplay || "—"));
  lines.push("*Status:* " + status);
  if (rule.startDaysOverdue >= 1 && daysOverdue === rule.startDaysOverdue) {
    lines.push("_First reminder for this rule (starts 1 day after deadline)._");
  }
  return lines.join("\n");
}

function postFactoryDeadlineDmToUsers_(userIds, text) {
  var list = userIds || [];
  for (var i = 0; i < list.length; i++) {
    try {
      postUrpsDmToUser_(list[i], text);
    } catch (err) {
      Logger.log("postFactoryDeadlineDmToUsers_ " + list[i] + ": " + err);
    }
  }
}

function clearFactoryDeadlineSentMarkersForRp_(props, rpNum) {
  var safeRp = normUrps_(rpNum);
  if (!safeRp) return;
  var prefix = FACTORY_DEADLINE_SLACK_CONFIG.SENT_KEY_PREFIX;
  var needle = "_" + safeRp;
  var all = props.getProperties();
  for (var key in all) {
    if (!Object.prototype.hasOwnProperty.call(all, key)) continue;
    if (key.indexOf(prefix) !== 0) continue;
    if (key.indexOf(needle) === -1) continue;
    props.deleteProperty(key);
  }
}

function processFactoryDeadlineAlertsForRow_(rowValues, rawRow, props, todayStart, todayYmd) {
  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  if (!rpNum) return;

  var factoryCode = normalizeFactoryCodeForDeadlineUrps_(rowValues[URGENT_PARTS_COL.REVIEW_GROUP - 1]);
  var rules = factoryCode ? FACTORY_DEADLINE_SLACK_CONFIG.FACTORY_RULES[factoryCode] : null;

  if (!isOpenForFactoryDeadlineAlertUrps_(rowValues[URGENT_PARTS_COL.STATUS - 1]) || !rules) {
    clearFactoryDeadlineSentMarkersForRp_(props, rpNum);
    return;
  }

  var deadlineRaw = rawRow[URGENT_PARTS_COL.EST_PROD_DATE - 1];
  var deadlineDisplay = normUrps_(rowValues[URGENT_PARTS_COL.EST_PROD_DATE - 1]);
  var deadlineStart = parseSheetDeadlineDateUrps_(deadlineRaw, deadlineDisplay);
  if (!deadlineStart) {
    clearFactoryDeadlineSentMarkersForRp_(props, rpNum);
    return;
  }

  var daysOverdue = getDaysOverdueFromDeadlineUrps_(deadlineStart, todayStart);
  var maxLead = getFactoryDeadlineMaxLeadDays_();
  if (daysOverdue < -maxLead) {
    clearFactoryDeadlineSentMarkersForRp_(props, rpNum);
    return;
  }

  for (var ri = 0; ri < rules.length; ri++) {
    var rule = rules[ri];
    if (!matchesFactoryDeadlineItemFilterUrps_(rule.itemFilter, rowValues)) continue;

    var sentKey = getFactoryDeadlineSentKey_(factoryCode, rule.id, rpNum);
    var lastSentYmd = normUrps_(props.getProperty(sentKey));
    if (!shouldSendFactoryDeadlineNotificationUrps_(daysOverdue, rule, lastSentYmd, todayYmd)) {
      continue;
    }

    var text = buildFactoryDeadlineOverdueMessage_(rowValues, factoryCode, rule, daysOverdue, deadlineDisplay);
    postFactoryDeadlineDmToUsers_(rule.userIds, text);
    props.setProperty(sentKey, todayYmd);
  }
}

/**
 * Daily sweep: DM factory contacts when column C deadline is due or overdue.
 * Runs Mon–Fri only; install with createFactoryDeadlineSlackTrigger() at 10:30 script TZ.
 */
function checkAndNotifyFactoryDeadlineOverdue() {
  if (!isUrpsWorkingWeekdayInScriptTz_()) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET);
  if (!sheet) throw new Error('Sheet "' + URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET + '" not found.');

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var range = sheet.getRange(2, 1, lastRow - 1, 25);
  var raw = range.getValues();
  var display = range.getDisplayValues();
  var props = PropertiesService.getScriptProperties();
  var todayStart = todayStartInScriptTzUrps_();
  var todayYmd = ymdCompactFromDateUrps_(todayStart);

  for (var i = 0; i < display.length; i++) {
    try {
      processFactoryDeadlineAlertsForRow_(display[i], raw[i], props, todayStart, todayYmd);
    } catch (rowErr) {
      Logger.log("checkAndNotifyFactoryDeadlineOverdue row " + (i + 2) + ": " + rowErr);
    }
  }
}

/** Manual utility: evaluate deadline DMs for one sheet row. */
function syncFactoryDeadlineSlackForRow(row) {
  var rowNum = Number(row) || 0;
  if (rowNum <= 1) throw new Error("Row number must be > 1.");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET);
  if (!sheet) throw new Error('Sheet "' + URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET + '" not found.');
  var raw = sheet.getRange(rowNum, 1, 1, 25).getValues()[0];
  var display = sheet.getRange(rowNum, 1, 1, 25).getDisplayValues()[0];
  var props = PropertiesService.getScriptProperties();
  var todayStart = todayStartInScriptTzUrps_();
  var todayYmd = ymdCompactFromDateUrps_(todayStart);
  processFactoryDeadlineAlertsForRow_(display, raw, props, todayStart, todayYmd);
}

/** One-time setup: daily clock trigger for factory deadline DMs (10:30 Mon–Fri). Safe to re-run. */
function createFactoryDeadlineSlackTrigger() {
  var handler = "checkAndNotifyFactoryDeadlineOverdue";
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  var hour = Number(FACTORY_DEADLINE_SLACK_CONFIG.DAILY_SWEEP_HOUR);
  var minute = Number(FACTORY_DEADLINE_SLACK_CONFIG.DAILY_SWEEP_MINUTE);
  if (isNaN(hour) || hour < 0 || hour > 23) hour = 10;
  if (isNaN(minute) || minute < 0 || minute > 59) minute = 30;
  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .nearMinute(minute)
    .create();
}

function deleteFactoryDeadlineSlackTrigger() {
  var handler = "checkAndNotifyFactoryDeadlineOverdue";
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function isPalletOrContainerShipMethodUrps_(methodUpper) {
  return methodUpper === "PALLET" || methodUpper === "CONTAINER";
}

function isLeavingReadyStatusEditUrps_(editEvent) {
  if (!editEvent || !editEvent.range || editEvent.range.getColumn() !== URGENT_PARTS_COL.STATUS) {
    return false;
  }
  var oldStatus = normUrps_(editEvent.oldValue).toUpperCase();
  var newStatus = normUrps_(editEvent.value).toUpperCase();
  return oldStatus === "READY" && newStatus && newStatus !== "READY" && newStatus !== "SHIPPED";
}

function isEnteringReadyStatusEditUrps_(editEvent) {
  if (!editEvent || !editEvent.range || editEvent.range.getColumn() !== URGENT_PARTS_COL.STATUS) {
    return false;
  }
  var oldStatus = normUrps_(editEvent.oldValue).toUpperCase();
  var newStatus = normUrps_(editEvent.value).toUpperCase();
  return newStatus === "READY" && oldStatus !== "READY";
}

/** Apply the cell being edited so onEdit sees the new value before the sheet read catches up. */
function applyUrpsEditEventToRowValues_(rowValues, editEvent, row) {
  if (!editEvent || !editEvent.range || editEvent.range.getRow() !== row) return rowValues;
  if (editEvent.value === undefined) return rowValues;
  var col = editEvent.range.getColumn();
  if (col < 1 || col > rowValues.length) return rowValues;
  var out = rowValues.slice();
  out[col - 1] = editEvent.value;
  return out;
}

function clearUrpsPalletReadySentFlag_(rpNum) {
  PropertiesService.getScriptProperties().deleteProperty(getUrpsPalletReadySentKey_(rpNum));
}

/** Manual utility: clear ready-to-ship dedupe for one RP (Script Properties UI caps at 50 keys). */
function clearUrpsPalletReadySentFlagForRp(rpNum) {
  clearUrpsPalletReadySentFlag_(rpNum);
}

/** Manual utility: remove all UPS_PALLET_READY_SENT_* script properties. */
function clearAllUrpsPalletReadySentFlags() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var prefix = "UPS_PALLET_READY_SENT_";
  var cleared = 0;
  for (var key in all) {
    if (!Object.prototype.hasOwnProperty.call(all, key)) continue;
    if (key.indexOf(prefix) !== 0) continue;
    props.deleteProperty(key);
    cleared++;
  }
  Logger.log("clearAllUrpsPalletReadySentFlags: removed " + cleared + " properties.");
  return cleared;
}

function scriptPropertyKeyMatchesRp_(key, rpToken) {
  if (!key || !rpToken) return false;
  var needle = "_" + rpToken;
  var idx = key.indexOf(needle);
  if (idx !== -1) {
    var afterNeedle = key.slice(idx + needle.length);
    if (afterNeedle === "" || afterNeedle.charAt(0) === "_") return true;
  }
  var directIdx = key.indexOf(rpToken);
  if (directIdx === -1) return false;
  var before = directIdx > 0 ? key.charAt(directIdx - 1) : "";
  var afterIdx = directIdx + rpToken.length;
  var after = afterIdx < key.length ? key.charAt(afterIdx) : "";
  return (before === "_" || before === "") && (after === "" || after === "_");
}

function resolveRpNumForPropertyCleanup_(rpNum) {
  if (typeof normalizeRpLabel_ === "function") {
    var normalized = normalizeRpLabel_(rpNum);
    if (normalized) return normalized;
  }
  var trimmed = normUrps_(rpNum);
  if (!trimmed) throw new Error("RP number is required.");
  return trimmed;
}

/**
 * Manual utility: remove all Slack/dedupe script properties for one RP.
 * Clears UPS hash, pallet-ready flags, factory DMs, escalation markers, production-date
 * alerts, and any other property keys scoped to that RP number.
 *
 * Usage (Apps Script editor):
 *   clearScriptPropertiesForRp("RP-501");
 *
 * Or run clearScriptPropertiesForRpPrompt() from the bound spreadsheet for a UI prompt.
 */
function clearScriptPropertiesForRp(rpNum) {
  var rp = resolveRpNumForPropertyCleanup_(rpNum);
  var props = PropertiesService.getScriptProperties();
  var cleared = [];
  var clearedSet = {};

  function del(key) {
    if (!key || clearedSet[key]) return;
    if (props.getProperty(key) !== null) {
      props.deleteProperty(key);
      cleared.push(key);
      clearedSet[key] = true;
    }
  }

  del(getUrpsHashKey_(rp));
  del("UPS_TS_" + rp);
  del(getUrpsPalletReadySentKey_(rp));
  del(getNikolayAksDmSentKey_("rp", rp));
  del(getUrgentPartFactoryDmSentKey_("instant", rp));
  del(getUrgentPartFactoryDmSentKey_("delayed", rp));

  var escalationHours = [5, 8, 12];
  if (typeof SLACK_ALERTS_CONFIG !== "undefined" && SLACK_ALERTS_CONFIG.ESCALATION_HOURS) {
    escalationHours = SLACK_ALERTS_CONFIG.ESCALATION_HOURS;
  }
  for (var i = 0; i < escalationHours.length; i++) {
    var hour = Number(escalationHours[i]) || 0;
    if (!hour) continue;
    if (typeof getEscalationKey_ === "function") {
      del(getEscalationKey_(rp, hour));
    } else {
      del("SLACK_ALERT_SENT_" + rp + "_" + hour + "H");
    }
  }

  var all = props.getProperties();
  for (var key in all) {
    if (!Object.prototype.hasOwnProperty.call(all, key)) continue;
    if (!scriptPropertyKeyMatchesRp_(key, rp)) continue;
    del(key);
  }

  try {
    CacheService.getScriptCache().remove("UPS_NOTREADY_" + rp);
  } catch (cacheErr) {
    Logger.log("clearScriptPropertiesForRp cache: " + cacheErr);
  }

  Logger.log("clearScriptPropertiesForRp(" + rp + "): removed " + cleared.length + " script property key(s).");
  if (cleared.length) Logger.log(cleared.join(", "));
  return { rpNum: rp, cleared: cleared, count: cleared.length };
}

/** Manual utility: prompt for an RP number and clear its script properties. */
function clearScriptPropertiesForRpPrompt() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "Clear script properties for RP",
    "Enter RP number (e.g. RP-501):",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  try {
    var result = clearScriptPropertiesForRp(response.getResponseText());
    var body = result.count
      ? "Cleared " + result.count + " key(s) for " + result.rpNum + ":\n\n" + result.cleared.join("\n")
      : "No script properties found for " + result.rpNum + ".";
    ui.alert(body);
  } catch (err) {
    ui.alert("Error: " + (err && err.message ? err.message : err));
  }
}

/**
 * One-way Slack ping when an RP line is Ready and ships by Pallet or Container.
 * Applies to both parts and panels (column K agnostic).
 * Channel: STANDARD_READY_PALLET_CONTAINER_CHANNEL_ID only (never fall back to the urgent thread
 * channel — that would duplicate the pallet message in both places).
 * Uses Script Properties to avoid duplicate posts while eligible; clears flag when not eligible.
 * Re-reads the row from the sheet so W/X updates from the web app are visible before posting.
 */
function maybeNotifyReadyPalletContainerShipment_(sheet, row, rpNum, editEvent) {
  if (!sheet || !row || row <= 1) return;
  rpNum = normUrps_(rpNum);
  if (!rpNum) return;

  var props = PropertiesService.getScriptProperties();
  var flagKey = getUrpsPalletReadySentKey_(rpNum);
  SpreadsheetApp.flush();
  var rowValues = applyUrpsEditEventToRowValues_(
    sheet.getRange(row, 1, 1, 25).getDisplayValues()[0],
    editEvent,
    row
  );

  var statusUpper = normUrps_(rowValues[URGENT_PARTS_COL.STATUS - 1]).toUpperCase();
  var methodUpper = normUrps_(rowValues[URGENT_PARTS_COL.SHIP_METHOD - 1]).toUpperCase();

  if (statusUpper !== "READY" || !isPalletOrContainerShipMethodUrps_(methodUpper)) {
    props.deleteProperty(flagKey);
    Logger.log(
      "Ready/pallet Slack skipped for " +
        rpNum +
        ": status=" +
        (statusUpper || "—") +
        " method=" +
        (methodUpper || "—")
    );
    return;
  }

  if (props.getProperty(flagKey)) {
    Logger.log("Ready/pallet Slack skipped for " + rpNum + ": dedupe flag still set (" + flagKey + ").");
    return;
  }

  var destChannel = normUrps_(URGENT_PARTS_SLACK_CONFIG.STANDARD_READY_PALLET_CONTAINER_CHANNEL_ID);
  if (!destChannel) {
    Logger.log("Ready/pallet Slack skipped: set STANDARD_READY_PALLET_CONTAINER_CHANNEL_ID (do not use urgent channel).");
    return;
  }

  var address = normUrps_(rowValues[URGENT_PARTS_COL.ADDRESS - 1]);
  var text = buildReadyPalletContainerSlackMessage_(rowValues, rpNum, methodUpper, address);

  try {
    var postResp = callSlackApiUrps_("chat.postMessage", {
      channel: destChannel,
      text: text
    });
    var postJson = parseSlackJsonUrps_(postResp);
    if (!postJson.ok) {
      Logger.log("Ready/pallet chat.postMessage failed for " + rpNum + ": " + (postJson.error || "unknown_error"));
      return;
    }
    props.setProperty(flagKey, String(Date.now()));
    Logger.log("Ready/pallet Slack posted for " + rpNum + ".");
  } catch (err) {
    Logger.log("Ready/pallet Slack notify failed for " + rpNum + ": " + err);
  }
}

/**
 * Manual debug: logs why a row would or would not get a ready-to-ship Slack post (does not post).
 */
function debugReadyPalletSlackForRow(row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET);
  if (!sheet) throw new Error('Sheet "' + URGENT_PARTS_SLACK_CONFIG.TARGET_SHEET + '" not found.');
  var rowNum = Number(row) || 0;
  if (rowNum <= 1) throw new Error("Row number must be > 1.");

  var rowValues = sheet.getRange(rowNum, 1, 1, 25).getDisplayValues()[0];
  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  var statusUpper = normUrps_(rowValues[URGENT_PARTS_COL.STATUS - 1]).toUpperCase();
  var methodUpper = normUrps_(rowValues[URGENT_PARTS_COL.SHIP_METHOD - 1]).toUpperCase();
  var address = normUrps_(rowValues[URGENT_PARTS_COL.ADDRESS - 1]);
  var flagKey = getUrpsPalletReadySentKey_(rpNum);
  var flagSet = !!PropertiesService.getScriptProperties().getProperty(flagKey);

  var lines = [
    "RP: " + (rpNum || "—"),
    "Row: " + rowNum,
    "Status (X): " + (statusUpper || "—"),
    "Ship method (W): " + (methodUpper || "—"),
    "Address (R): " + (address || "—"),
    "Dedupe flag " + flagKey + ": " + (flagSet ? "SET" : "not set"),
    "Would post: " +
      (statusUpper === "READY" &&
      isPalletOrContainerShipMethodUrps_(methodUpper) &&
      !flagSet)
  ];
  Logger.log(lines.join("\n"));
  return lines.join("\n");
}

function getUrpsPalletReadySentKey_(rpNum) {
  return "UPS_PALLET_READY_SENT_" + normUrps_(rpNum);
}

function appendUrpsModelAndPanelPartLines_(lines, rowValues) {
  var model = normUrps_(rowValues[URGENT_PARTS_COL.MODEL - 1]);
  var itemValue = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]);
  if (model) lines.push("*Model:* " + model);
  if (itemValue) lines.push("*Panel / Part:* " + itemValue);
}

function buildReadyPalletContainerSlackMessage_(rowValues, rpNum, methodUpper, address) {
  var client = normUrps_(rowValues[URGENT_PARTS_COL.CLIENT - 1]);
  var recipient = normUrps_(rowValues[URGENT_PARTS_COL.RECIPIENT - 1]);
  var urgencyLower = normUrps_(rowValues[URGENT_PARTS_COL.URGENCY - 1]).toLowerCase();
  var isUrgent = urgencyLower === "urgent";

  var methodLabel = methodUpper === "CONTAINER" ? "Container" : "Pallet";
  var assignAsk =
    methodUpper === "CONTAINER"
      ? "Assign a *container* using the address below."
      : "Assign a *pallet* using the address below.";

  var firstLine = isUrgent
    ? ":rotating_light: *URGENT* — *" + rpNum + "* · Ready · " + methodLabel
    : ":white_check_mark: *" + rpNum + "* · Ready · " + methodLabel;

  var lines = [firstLine, assignAsk];
  appendUrpsModelAndPanelPartLines_(lines, rowValues);
  if (address) {
    lines.push("", "*Shipping address:*", address);
  } else {
    lines.push("", "_Shipping address not on file (column R) — check the sheet._");
  }

  if (client) lines.push("", "*Client:* " + client);
  if (recipient) lines.push("*Recipient:* " + recipient);

  return lines.join("\n");
}

/**
 * Legacy one-shot shipping ping for urgent panels made Ready via urgent-panel flows.
 * Kept for compatibility; main ready-to-ship notifications are handled by
 * maybeNotifyReadyPalletContainerShipment_.
 */
function notifyUrgentPanelReadyForPalletShipping_(sheet, rowNum) {
  var channelId = normUrps_(URGENT_PARTS_SLACK_CONFIG.STANDARD_READY_PALLET_CONTAINER_CHANNEL_ID);
  if (!channelId) {
    Logger.log("notifyUrgentPanelReadyForPalletShipping_: STANDARD_READY_PALLET_CONTAINER_CHANNEL_ID not set.");
    return;
  }

  var rowValues = sheet.getRange(rowNum, 1, 1, 25).getDisplayValues()[0];
  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  if (!rpNum) return;

  var itemUpper = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]).toUpperCase();
  if (isPartLikeUrgentItem_(itemUpper)) return;

  var urgencyLower = normUrps_(rowValues[URGENT_PARTS_COL.URGENCY - 1]).toLowerCase();
  var isUrgent = urgencyLower === "urgent";
  var address = normUrps_(rowValues[URGENT_PARTS_COL.ADDRESS - 1]);
  var client = normUrps_(rowValues[URGENT_PARTS_COL.CLIENT - 1]);
  var recipient = normUrps_(rowValues[URGENT_PARTS_COL.RECIPIENT - 1]);
  var lines = [isUrgent
    ? ":rotating_light: *URGENT* — *" + rpNum + "* · Ready · Pallet"
    : ":white_check_mark: *" + rpNum + "* · Ready · Pallet"];
  lines.push("Assign a *pallet* for this panel.");
  appendUrpsModelAndPanelPartLines_(lines, rowValues);
  if (address) lines.push("", "*Shipping address:*", address);
  if (client) lines.push("", "*Client:* " + client);
  if (recipient) lines.push("*Recipient:* " + recipient);

  try {
    var postResp = callSlackApiUrps_("chat.postMessage", {
      channel: channelId,
      text: lines.join("\n")
    });
    var postJson = parseSlackJsonUrps_(postResp);
    if (!postJson.ok) {
      Logger.log("notifyUrgentPanelReadyForPalletShipping_: " + (postJson.error || "unknown_error"));
    }
  } catch (err) {
    Logger.log("notifyUrgentPanelReadyForPalletShipping_: " + err);
  }
}

function buildUrgentPartsSlackMessage_(rowValues, statusRaw, statusUpper) {
  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  var estProdDate = normUrps_(rowValues[URGENT_PARTS_COL.EST_PROD_DATE - 1]);
  var boothId = normUrps_(rowValues[URGENT_PARTS_COL.BOOTH_ID - 1]);
  var color = normUrps_(rowValues[URGENT_PARTS_COL.COLOR - 1]);
  var qty = normUrps_(rowValues[URGENT_PARTS_COL.QTY - 1]);
  var desc = normUrps_(rowValues[URGENT_PARTS_COL.DESC - 1]);
  var notes = normUrps_(rowValues[URGENT_PARTS_COL.NOTES - 1]);
  var client = normUrps_(rowValues[URGENT_PARTS_COL.CLIENT - 1]);
  var shipMethod = normUrps_(rowValues[URGENT_PARTS_COL.SHIP_METHOD - 1]);
  var tracking = normUrps_(rowValues[URGENT_PARTS_COL.TRACKING - 1]);
  var itemValue = normUrps_(rowValues[URGENT_PARTS_COL.ITEM_VALUE - 1]).toUpperCase();

  var isPart = isPartLikeUrgentItem_(itemValue);
  var typeWord = isPart ? "Part" : "Panel";

  var statusIcon = "ℹ️";
  if (statusUpper === "READY") statusIcon = "✅";
  else if (statusUpper === "SHIPPED") statusIcon = "📦";
  else if (statusUpper === "CANCELLED") statusIcon = "❌";
  else if (statusUpper === "DELAYED") statusIcon = "⚠️";

  var finalHeader = statusRaw
    ? statusIcon + " *" + rpNum + " - " + typeWord + "* — *" + statusRaw + "*"
    : "🚨 *" + rpNum + " - " + typeWord + "*";

  var lines = [
    finalHeader,
    "*Booth ID:* " + boothId + (color ? ", " + color : ""),
    "*Item:* " + (qty || "N/A") + " x " + (desc || "N/A"),
    "*Client:* " + (client || "N/A")
  ];

  if (notes) lines.push("*Notes:* " + notes);
  if (estProdDate && statusUpper !== "READY" && statusUpper !== "SHIPPED") {
    lines.push("*Estimated Shipping Date:* " + estProdDate);
  }
  if (statusUpper === "SHIPPED") {
    lines.push("*Method:* " + (shipMethod || "N/A"));
    lines.push("*Tracking:* " + (tracking || "Pending"));
  }

  return lines.join("\n");
}

function callSlackApiUrps_(method, payload) {
  var token = resolveUrpsBotToken_();

  return UrlFetchApp.fetch("https://slack.com/api/" + method, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
}

function parseSlackJsonUrps_(response) {
  var text = response ? response.getContentText() : "";
  try {
    return JSON.parse(text || "{}");
  } catch (err) {
    throw new Error("Invalid Slack API response JSON.");
  }
}

function getUrpsHashKey_(rpNum) {
  return "UPS_HASH_" + rpNum;
}

function hashUrps_(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normUrps_(text));
  return Utilities.base64EncodeWebSafe(digest);
}

function normUrps_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function resolveUrpsBotToken_() {
  if (typeof SLACK_ALERTS_CONFIG !== "undefined" && SLACK_ALERTS_CONFIG) {
    var shared = normUrps_(SLACK_ALERTS_CONFIG.BOT_TOKEN);
    if (shared) return shared;
  }

  var fallback = normUrps_(URGENT_PARTS_SLACK_CONFIG.BOT_TOKEN_FALLBACK);
  if (fallback) return fallback;

  throw new Error("Missing Slack bot token. Set SLACK_ALERTS_CONFIG.BOT_TOKEN or URGENT_PARTS_SLACK_CONFIG.BOT_TOKEN_FALLBACK.");
}

/**
 * Shipping / logistics channel: RP left Ready (not shipped) — do not treat as ready to ship.
 * Called from sheet onEdit (status column) and from WebAppLogic when Anna delays from Ready.
 * Channel: STANDARD_READY_PALLET_CONTAINER_CHANNEL_ID.
 * Dedupes duplicate fires (web + onEdit) via script cache for 20s only after a successful chat.postMessage.
 */
function notifyShippingSlackNoLongerReady_(sheet, rowNum, newStatusDisplay) {
  var channelId = normUrps_(URGENT_PARTS_SLACK_CONFIG.STANDARD_READY_PALLET_CONTAINER_CHANNEL_ID);
  if (!channelId) {
    Logger.log("notifyShippingSlackNoLongerReady_: STANDARD_READY_PALLET_CONTAINER_CHANNEL_ID not set.");
    return;
  }
  var rowValues = sheet.getRange(rowNum, 1, 1, 25).getDisplayValues()[0];
  var methodUpper = normUrps_(rowValues[URGENT_PARTS_COL.SHIP_METHOD - 1]).toUpperCase();
  if (!isPalletOrContainerShipMethodUrps_(methodUpper)) return;

  var rpNum = normUrps_(rowValues[URGENT_PARTS_COL.RP_NUM - 1]);
  if (!rpNum) return;

  clearUrpsPalletReadySentFlag_(rpNum);

  var dedupeKey = "UPS_NOTREADY_" + rpNum;
  var scriptCache = CacheService.getScriptCache();
  if (scriptCache.get(dedupeKey)) return;

  var newLabel = normUrps_(newStatusDisplay) || "—";
  var lines = [
    ":warning: *" + rpNum + "* was *Ready*, now *" + newLabel + "*.",
    "Do not ship or assign pallet/container for this RP until logistics is informed again."
  ];
  var text = lines.join("\n");
  try {
    var postResp = callSlackApiUrps_("chat.postMessage", { channel: channelId, text: text });
    var postJson = parseSlackJsonUrps_(postResp);
    if (!postJson.ok) {
      Logger.log("notifyShippingSlackNoLongerReady_: " + (postJson.error || "unknown"));
      return;
    }
    scriptCache.put(dedupeKey, "1", 20);
  } catch (err) {
    Logger.log("notifyShippingSlackNoLongerReady_: " + err);
  }
}
