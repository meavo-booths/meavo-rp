import { google } from "googleapis";

import { loadServerEnv } from "@/lib/env";
import { parseGoogleServiceAccountJson } from "@/lib/google-service-account";

const CATALOGUE_SPREADSHEET_ID =
  process.env.CATALOGUE_SPREADSHEET_ID ??
  "1xXVPeUO6ywApCk5UKwngHJoFDxFEebRDjfjEeTVn0T8";

const SHEET_NAMES = [
  "Electrics",
  "Parts & Tools",
  "USA Specific Parts",
  "Old Parts",
];

/**
 * Catalogue sheet columns (legacy CatalogueLogic.js):
 * A = RP code, B = description, C = booth, D = photo (URL or HYPERLINK), E = Standard partner.
 */
export type CatalogueRow = {
  subcategory?: string;
  code?: string;
  description?: string;
  booth?: string;
  photoUrl?: string;
  imageFileId?: string;
  standardPartner?: string;
};

export type CatalogueCategory = {
  category: string;
  rows: CatalogueRow[];
};

async function getSheets() {
  const json = loadServerEnv().GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const credentials = parseGoogleServiceAccountJson(json);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function extractDriveFileId(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$|\?)/,
    /\/open\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const m = trimmed.match(pattern);
    if (m) return m[1];
  }
  return "";
}

/** Port of legacy extractUrlFromHyperlinkFormula_. */
function extractUrlFromHyperlinkFormula(formula: string): string {
  const f = formula.trim();
  if (!f || !f.toUpperCase().includes("HYPERLINK")) return "";
  let m = f.match(/HYPERLINK\s*\(\s*"((?:[^"\\]|\\.)*)"/i);
  if (m) return m[1].replace(/\\"/g, '"').trim();
  m = f.match(/HYPERLINK\s*\(\s*'((?:[^'\\]|\\.)*)'/i);
  if (m) return m[1].replace(/\\'/g, "'").trim();
  m = f.match(/HYPERLINK\s*\(\s*([^;,)\s]+)/i);
  if (m) return m[1].replace(/^["']|["']$/g, "").trim();
  return "";
}

function extractUrlFromCell(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  let url = raw;
  if (!/^https?:\/\//i.test(url)) {
    const match = raw.match(/https?:\/\/[^\s"')]+/i);
    url = match ? match[0] : "";
  }
  return url;
}

/** Drive /view links are HTML pages; use the thumbnail endpoint for <img src>. */
function normalizeDriveImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const fileId = extractDriveFileId(trimmed);
  if (!fileId) return trimmed;
  if (/^https?:\/\/lh3\.googleusercontent\.com\//i.test(trimmed)) return trimmed;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`;
}

function cellText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

export async function getCatalogueData(): Promise<CatalogueCategory[]> {
  const sheets = await getSheets();
  const ranges = SHEET_NAMES.map((name) => `'${name}'!A2:E`);

  let valueRes;
  let formulaRes;
  try {
    [valueRes, formulaRes] = await Promise.all([
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: CATALOGUE_SPREADSHEET_ID,
        ranges,
      }),
      sheets.spreadsheets.values.batchGet({
        spreadsheetId: CATALOGUE_SPREADSHEET_ID,
        ranges,
        valueRenderOption: "FORMULA",
      }),
    ]);
  } catch {
    return SHEET_NAMES.map((category) => ({ category, rows: [] }));
  }

  const categories: CatalogueCategory[] = [];

  SHEET_NAMES.forEach((sheetName, sheetIdx) => {
    const values = valueRes.data.valueRanges?.[sheetIdx]?.values ?? [];
    const formulas = formulaRes.data.valueRanges?.[sheetIdx]?.values ?? [];
    const rows: CatalogueRow[] = [];
    let currentSub = "";

    values.forEach((row, rowIdx) => {
      const code = cellText(row[0]);
      const description = cellText(row[1]);
      const booth = cellText(row[2]);
      const photoCell = cellText(row[3]);
      const standardPartner = cellText(row[4]);

      if (code.toLowerCase() === "subcategory") {
        currentSub = description;
        return;
      }
      if (!code || !description) return;

      const photoFormula = cellText(formulas[rowIdx]?.[3]);
      const photoSource =
        extractUrlFromHyperlinkFormula(photoFormula) || photoCell;
      const photoUrl = normalizeDriveImageUrl(extractUrlFromCell(photoSource));
      const imageFileId =
        extractDriveFileId(photoSource) || extractDriveFileId(photoUrl);

      rows.push({
        subcategory: currentSub,
        code,
        description,
        booth: booth || undefined,
        photoUrl: photoUrl || undefined,
        imageFileId: imageFileId || undefined,
        standardPartner: standardPartner || undefined,
      });
    });
    categories.push({ category: sheetName, rows });
  });
  return categories;
}

function isStandardPartnerYesValue(value: string | undefined): boolean {
  const sp = (value ?? "").trim().toLowerCase();
  return sp === "yes" || sp === "y" || sp === "true" || sp === "1";
}

/**
 * Port of legacy lookupStandardPartnerYesFromCatalogue_: the "Standard partner"
 * flag comes from catalogue column E for the matching 4-digit RP code.
 */
export async function lookupStandardPartnerYes(code: string): Promise<boolean> {
  const normalized = code.replace(/\D/g, "");
  if (!/^\d{4}$/.test(normalized)) return false;
  try {
    const categories = await getCatalogueData();
    for (const category of categories) {
      for (const row of category.rows) {
        if ((row.code ?? "").replace(/\D/g, "") !== normalized) continue;
        return isStandardPartnerYesValue(row.standardPartner);
      }
    }
  } catch {
    // Catalogue unavailable — treat as not a standard-partner item.
  }
  return false;
}
