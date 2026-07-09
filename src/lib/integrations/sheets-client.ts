import { google, type sheets_v4 } from "googleapis";
import { loadServerEnv } from "@/lib/env";
import { parseGoogleServiceAccountJson } from "@/lib/google-service-account";

export function getRepPartsSpreadsheetId(): string {
  const id = loadServerEnv().REP_PARTS_SPREADSHEET_ID;
  if (!id) throw new Error("REP_PARTS_SPREADSHEET_ID is not set");
  return id;
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const json = loadServerEnv().GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const credentials = parseGoogleServiceAccountJson(json);

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

/** 0-based column index → A, B, …, Z, AA, … */
export function columnLetter(index: number): string {
  let letter = "";
  let value = index;
  while (value >= 0) {
    letter = String.fromCharCode((value % 26) + 65) + letter;
    value = Math.floor(value / 26) - 1;
  }
  return letter;
}
