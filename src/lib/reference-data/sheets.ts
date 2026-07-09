import { google } from "googleapis";

import { loadServerEnv } from "@/lib/env";
import { parseGoogleServiceAccountJson } from "@/lib/google-service-account";
import {
  ADDRESS_BOOK_SPREADSHEET_ID,
  PANEL_OPTIONS_SPREADSHEET_ID,
} from "@/lib/reference-data/constants";

export type AddressBookEntry = {
  address: string;
  recipient: string;
  phone: string;
  email: string;
};

async function getAuthSheets() {
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

export async function getAddressBookEntries(): Promise<AddressBookEntry[]> {
  const sheets = await getAuthSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ADDRESS_BOOK_SPREADSHEET_ID,
    range: "Addresses!A2:D",
  });
  const seen = new Set<string>();
  const out: AddressBookEntry[] = [];
  for (const row of res.data.values ?? []) {
    const address = (row[0] ?? "").trim();
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      address,
      recipient: (row[1] ?? "").trim(),
      phone: (row[2] ?? "").trim(),
      email: (row[3] ?? "").trim(),
    });
  }
  return out;
}

export type PanelOptionsPayload = {
  modelOptions: Record<string, string[]>;
  allOptions: string[];
};

function normalizePanelModelKey(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/[^a-z0-9]/g, "");
}

export async function getPanelOptionsByBoothModel(): Promise<PanelOptionsPayload> {
  const sheets = await getAuthSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: PANEL_OPTIONS_SPREADSHEET_ID,
    range: "Panels",
  });
  const values = res.data.values ?? [];
  if (values.length < 2) return { modelOptions: {}, allOptions: [] };

  const headers = values[0] ?? [];
  const modelOptions: Record<string, string[]> = {};
  const allOptions: string[] = [];
  const allSeen = new Set<string>();

  for (let col = 0; col < headers.length; col++) {
    const header = String(headers[col] ?? "").trim();
    if (!header) continue;
    const modelKey = normalizePanelModelKey(header);
    if (!modelKey) continue;
    const options: string[] = [];
    const seen = new Set<string>();
    for (let row = 1; row < values.length; row++) {
      const option = String(values[row]?.[col] ?? "").trim();
      if (!option || seen.has(option)) continue;
      seen.add(option);
      options.push(option);
      if (!allSeen.has(option)) {
        allSeen.add(option);
        allOptions.push(option);
      }
    }
    if (options.length) modelOptions[modelKey] = options;
  }

  return { modelOptions, allOptions };
}

export async function lookupSparePartFromRepSheet(
  code: string,
): Promise<{ found: boolean; code: string; description: string }> {
  const normalized = code.replace(/\D/g, "");
  if (!/^\d{4}$/.test(normalized)) {
    return { found: false, code: "", description: "" };
  }
  const sheets = await getAuthSheets();
  const spreadsheetId = loadServerEnv().REP_PARTS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return { found: false, code: normalized, description: "" };
  }
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Spare Parts Codes!A:B",
  });
  for (const row of res.data.values ?? []) {
    const rowCode = String(row[0] ?? "").replace(/\D/g, "");
    if (rowCode === normalized) {
      return {
        found: true,
        code: normalized,
        description: String(row[1] ?? "").trim(),
      };
    }
  }
  return { found: false, code: normalized, description: "" };
}
