/** LOGIN / ENTRY LOGIC */

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const view = String(params.view || "").toLowerCase();
  const userEmail = Session.getActiveUser().getEmail();

  let templateName = "index";
  if (view === "logger") templateName = "Logger";
  else if (view === "iplogger") templateName = "IpLogger";

  const template = HtmlService.createTemplateFromFile(templateName);
  template.userEmail = userEmail;
  template.scriptUrl = ScriptApp.getService().getUrl();
  template.editRp = String(params.editRp || "");
  template.similarRp = String(params.similarRp || "");

  return template.evaluate()
    .setTitle("Meavo Spare Parts")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Eagerly touches features/scopes used later in the app so users authorize once up front.
 * Safe to call on every page load; individual warmup steps are best-effort.
 */
function primeUserAuthorizations() {
  var out = { ok: true, warmed: [], failed: {} };

  function tryStep_(name, fn) {
    try {
      fn();
      out.warmed.push(name);
    } catch (e) {
      out.failed[name] = e && e.message ? e.message : String(e);
    }
  }

  // Core spreadsheet access (bound sheet + current user identity scope).
  tryStep_("activeSpreadsheet", function() {
    SpreadsheetApp.getActiveSpreadsheet().getId();
    Session.getActiveUser().getEmail();
  });

  // External sheets used by Logger form.
  if (typeof getAddressBookEntries === "function") {
    tryStep_("addressBook", function() { getAddressBookEntries(); });
  }
  if (typeof getPanelOptionsByBoothModel === "function") {
    tryStep_("panelOptions", function() { getPanelOptionsByBoothModel(); });
  }
  if (typeof getSparePartLookupMap_ === "function") {
    tryStep_("sparePartsLookup", function() { getSparePartLookupMap_(); });
  }

  // Catalogue + script properties/cache scopes.
  if (typeof getCatalogueData === "function") {
    tryStep_("catalogueData", function() { getCatalogueData(); });
  }

  // Drive scope used when loading catalogue images later.
  if (typeof getCatalogueDriveImageDataUrl === "function") {
    tryStep_("catalogueDrive", function() { getCatalogueDriveImageDataUrl("warmup_drive_scope"); });
  }

  // Drive scope for RP photo uploads on logger submit.
  if (typeof warmRpPhotosDriveScope_ === "function") {
    tryStep_("rpPhotosDrive", function() { warmRpPhotosDriveScope_(); });
  }

  return out;
}
