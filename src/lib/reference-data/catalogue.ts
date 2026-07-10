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

export type CatalogueRow = {
  subcategory?: string;
  code?: string;
  description?: string;
  imageFileId?: string;
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

export function lookupStandardPartnerYes(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  return normalized.startsWith("SP-") || normalized.startsWith("RP-");
}

export async function getCatalogueData(): Promise<CatalogueCategory[]> {
  const sheets = await getSheets();
  const categories: CatalogueCategory[] = [];

  for (const sheetName of SHEET_NAMES) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: CATALOGUE_SPREADSHEET_ID,
        range: `'${sheetName}'!A2:F`,
      });
      const rows: CatalogueRow[] = [];
      let currentSub = "";
      for (const row of res.data.values ?? []) {
        const colA = (row[0] ?? "").trim();
        if (colA.toLowerCase() === "subcategory") {
          currentSub = (row[1] ?? "").trim();
          continue;
        }
        if (!colA && !row[1]) continue;
        rows.push({
          subcategory: currentSub,
          code: colA,
          description: (row[1] ?? "").trim(),
          imageFileId: (row[5] ?? "").trim() || undefined,
        });
      }
      categories.push({ category: sheetName, rows });
    } catch {
      categories.push({ category: sheetName, rows: [] });
    }
  }
  return categories;
}
