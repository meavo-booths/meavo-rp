/** CATALOGUE LOGIC (EXTERNAL SPREADSHEET SOURCE) */

var CATALOGUE_CONFIG = {
  SPREADSHEET_ID_PROP: "CATALOGUE_SPREADSHEET_ID",
  SPREADSHEET_ID_FALLBACK: "1xXVPeUO6ywApCk5UKwngHJoFDxFEebRDjfjEeTVn0T8",
  SHEET_NAMES: ["Electrics", "Parts & Tools", "USA Specific Parts", "Old Parts"],
  CACHE_KEY: "catalogue_data_v3",
  CACHE_TTL_SECONDS: 300 // 5 min
};

/**
 * Returns normalized catalogue data grouped by category sheet.
 * Divider row rule:
 *  - Column A equals "Subcategory" => subcategory row
 */
function getCatalogueData() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CATALOGUE_CONFIG.CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      // rebuild if cache is malformed
    }
  }

  var spreadsheetId = resolveCatalogueSpreadsheetId_();
  var sourceSs = SpreadsheetApp.openById(spreadsheetId);
  var categories = [];

  CATALOGUE_CONFIG.SHEET_NAMES.forEach(function(sheetName) {
    var sheet = sourceSs.getSheetByName(sheetName);
    if (!sheet) {
      categories.push({
        category: sheetName,
        rows: []
      });
      return;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      categories.push({
        category: sheetName,
        rows: []
      });
      return;
    }

    // Row 1 = headers; read all data through lastRow (do not use lastRow-1 — that drops the final row).
    var dataRange = sheet.getRange(2, 1, lastRow, 5);
    var values = dataRange.getDisplayValues();
    var richTexts = [];
    try {
      richTexts = dataRange.getRichTextValues() || [];
    } catch (eRich) {
      // Older runtimes without getRichTextValues — photo column falls back to display text only
    }
    while (richTexts.length < values.length) {
      richTexts.push([null, null, null, null, null]);
    }
    var photoFormulas = sheet.getRange(2, 4, lastRow, 4).getFormulas() || [];
    while (photoFormulas.length < values.length) {
      photoFormulas.push([""]);
    }
    var rows = [];
    var currentSubcategory = "";

    values.forEach(function(row, rowIdx) {
      var rpCode = normalizeCatalogueText_(row[0]);
      var description = normalizeCatalogueText_(row[1]);
      var booth = normalizeCatalogueText_(row[2]);
      var photoCell = normalizeCatalogueText_(row[3]);
      var photoFromLink =
        extractUrlFromRichTextCell_(richTexts[rowIdx] && richTexts[rowIdx][3]) ||
        extractUrlFromHyperlinkFormula_(photoFormulas[rowIdx] && photoFormulas[rowIdx][0]);
      var photoSource = photoFromLink || photoCell;
      var standardPartner = normalizeCatalogueText_(row[4]);

      if (!rpCode && !description && !booth && !photoCell && !photoFromLink && !standardPartner) {
        return;
      }

      // Divider row / subcategory marker (Column A says "Subcategory")
      if (rpCode.toLowerCase() === "subcategory") {
        currentSubcategory = description;
        rows.push({
          type: "subcategory",
          subcategory: description
        });
        return;
      }

      if (!rpCode || !description) {
        return;
      }

      var photoUrl = extractUrlFromCell_(photoSource);
      var photoDriveFileId = extractDriveFileId_(photoFromLink || photoCell) || extractDriveFileId_(photoUrl);

      rows.push({
        type: "item",
        id: sheetName + ":" + rpCode,
        rpCode: rpCode,
        description: description,
        booth: booth,
        photoUrl: photoUrl,
        photoDriveFileId: photoDriveFileId,
        standardPartner: standardPartner,
        subcategory: currentSubcategory
      });
    });

    categories.push({
      category: sheetName,
      rows: rows
    });
  });

  var payload = {
    categories: categories,
    fetchedAt: new Date().toISOString()
  };

  try {
    cache.put(CATALOGUE_CONFIG.CACHE_KEY, JSON.stringify(payload), CATALOGUE_CONFIG.CACHE_TTL_SECONDS);
  } catch (err) {
    // Ignore cache write failure
  }

  return payload;
}

function clearCatalogueCache() {
  var cache = CacheService.getScriptCache();
  cache.remove(CATALOGUE_CONFIG.CACHE_KEY);
  cache.remove("catalogue_data_v2");
  cache.remove("catalogue_data_v1");
  return "Catalogue cache cleared.";
}

/**
 * Fetches a Drive file the web app user may not be able to hotlink in <img>.
 * Runs as the deployed script identity; file must be readable by that user.
 * Returns a data URL or "" on failure (too large / not an image / no access).
 */
function getCatalogueDriveImageDataUrl(fileId) {
  return getCatalogueDriveImageDataUrlInternal_(fileId, 4500000);
}

/** Batch path uses a smaller cap so many images fit in one RPC without timeouts. */
function getCatalogueDriveImageDataUrlsBatch(fileIds) {
  var list = normalizeBatchFileIds_(fileIds);
  var out = {};
  var maxPerImage = 1100000; // ~1 MB — keeps catalogue batch fast; use smaller files for parts photos
  for (var i = 0; i < list.length; i++) {
    var id = list[i];
    var dataUrl = getCatalogueDriveImageDataUrlInternal_(id, maxPerImage);
    if (dataUrl) out[id] = dataUrl;
  }
  return out;
}

function normalizeBatchFileIds_(fileIds) {
  if (!fileIds) return [];
  if (typeof fileIds === "string") {
    try {
      var parsed = JSON.parse(fileIds);
      if (Object.prototype.toString.call(parsed) === "[object Array]") return dedupeValidDriveIds_(parsed);
    } catch (e0) {}
    return [];
  }
  if (Object.prototype.toString.call(fileIds) === "[object Array]") return dedupeValidDriveIds_(fileIds);
  return [];
}

function dedupeValidDriveIds_(arr) {
  var seen = {};
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var id = normalizeCatalogueText_(arr[i]);
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || seen[id]) continue;
    seen[id] = true;
    out.push(id);
  }
  return out;
}

function getCatalogueDriveImageDataUrlInternal_(fileId, maxBytes) {
  var id = normalizeCatalogueText_(fileId);
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return "";
  var cap = typeof maxBytes === "number" && maxBytes > 0 ? maxBytes : 4500000;
  try {
    var file = DriveApp.getFileById(id);
    var blob = file.getBlob();
    var ct = (blob.getContentType() || "").toLowerCase();
    if (ct.indexOf("image/") !== 0) {
      ct = guessImageMimeFromDriveFile_(file);
      if (!ct) return "";
    }
    var bytes = blob.getBytes();
    if (!bytes || bytes.length > cap) return "";
    return "data:" + ct + ";base64," + Utilities.base64Encode(bytes);
  } catch (e) {
    return "";
  }
}

/** Drive often returns application/octet-stream for JPEGs; infer from file name. */
function guessImageMimeFromDriveFile_(file) {
  var name = normalizeCatalogueText_(file.getName()).toLowerCase();
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.webp$/i.test(name)) return "image/webp";
  return "";
}

function resolveCatalogueSpreadsheetId_() {
  var fromProps = normalizeCatalogueText_(
    PropertiesService.getScriptProperties().getProperty(CATALOGUE_CONFIG.SPREADSHEET_ID_PROP)
  );
  var fromFallback = normalizeCatalogueText_(CATALOGUE_CONFIG.SPREADSHEET_ID_FALLBACK);
  var id = fromProps || fromFallback;
  if (!id) {
    throw new Error(
      "Missing catalogue spreadsheet ID. Set Script Property " +
      CATALOGUE_CONFIG.SPREADSHEET_ID_PROP +
      " or CATALOGUE_CONFIG.SPREADSHEET_ID_FALLBACK in CatalogueLogic.js."
    );
  }
  return id;
}

function extractUrlFromCell_(value) {
  var raw = normalizeCatalogueText_(value);
  if (!raw) return "";
  var url = raw;
  if (!/^https?:\/\//i.test(url)) {
    var match = raw.match(/https?:\/\/[^\s"')]+/i);
    url = match ? match[0] : "";
  }
  if (!url) return "";
  return normalizeDriveImageUrl_(url);
}

/** Prefer real URL from a linked cell (paste as link often hides URL from display text). */
function extractUrlFromRichTextCell_(richText) {
  if (!richText) return "";
  try {
    if (typeof richText.getLinkUrl === "function") {
      var whole = richText.getLinkUrl();
      if (whole) return normalizeCatalogueText_(whole);
    }
  } catch (e0) {}
  try {
    var runs = richText.getRuns();
    if (runs && runs.length) {
      for (var i = 0; i < runs.length; i++) {
        var run = runs[i];
        if (run && typeof run.getLinkUrl === "function") {
          var link = run.getLinkUrl();
          if (link) return normalizeCatalogueText_(link);
        }
      }
    }
  } catch (e1) {}
  return "";
}

function extractUrlFromHyperlinkFormula_(formula) {
  var f = normalizeCatalogueText_(formula);
  if (!f || f.toUpperCase().indexOf("HYPERLINK") === -1) return "";
  var m = f.match(/HYPERLINK\s*\(\s*"((?:[^"\\]|\\.)*)"/i);
  if (m) return normalizeCatalogueText_(m[1].replace(/\\"/g, '"'));
  m = f.match(/HYPERLINK\s*\(\s*'((?:[^'\\]|\\.)*)'/i);
  if (m) return normalizeCatalogueText_(m[1].replace(/\\'/g, "'"));
  m = f.match(/HYPERLINK\s*\(\s*([^;,)\s]+)/i);
  if (m) return normalizeCatalogueText_(m[1].replace(/^["']|["']$/g, ""));
  return "";
}

function extractDriveFileId_(url) {
  var trimmed = normalizeCatalogueText_(url);
  if (!trimmed) return "";
  var m = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$|\?)/);
  if (m) return m[1];
  m = trimmed.match(/\/open\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = trimmed.match(/drive\.google\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return "";
}

/**
 * Google Drive "open file" /view links are HTML pages, not image bytes.
 * Use thumbnail URL for <img src>; client may fall back to uc?export=view.
 */
function normalizeDriveImageUrl_(url) {
  var trimmed = normalizeCatalogueText_(url);
  if (!trimmed) return "";
  var fileId = extractDriveFileId_(trimmed);
  if (!fileId) return trimmed;
  if (/^https?:\/\/lh3\.googleusercontent\.com\//i.test(trimmed)) return trimmed;
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w600";
}

function normalizeCatalogueText_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

