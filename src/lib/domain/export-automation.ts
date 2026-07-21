import { prisma } from "@/lib/prisma";
import { recordLifecycleEvent } from "@/lib/domain/lifecycle-events";
import { enqueueSheetSync } from "@/lib/domain/panel-orders";
import { notifyAfterRpMutation } from "@/lib/integrations/slack/rp-slack-bot";
import { getSheetsClient } from "@/lib/integrations/sheets-client";
import { loadServerEnv } from "@/lib/env";

const EXPORT_PALLET_NOT_FOUND = "Pallet number not found";

const CONFIG = {
  iznosSpreadsheetId:
    process.env.IZNOS_SPREADSHEET_ID ??
    "1ek1j6DFfTd4BfdI1MiPQedg0jr-V1VoYKHTpXW4DaKs",
  iznosSheetName: "Износ",
  iznosStartRow: 3583,
  iznosColPallet: 6,
  iznosColRpCodes: 12,
  iznosColSectionLabel: 12,
  iznosColHeader: 0,
  sectionLabel: "Резервни части",
  freightSpreadsheetId:
    process.env.FREIGHT_SPREADSHEET_ID ??
    "1Gfgi6N2fuilpXLcTuqt49tEskoMjF4A0d1eic8Hc7b8",
  freightSheetName: "Freight",
  freightStartRow: 1074,
  freightKeyCol: 5,
  freightRpCol: 1,
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeRpCode(value: string): string {
  const raw = norm(value).toUpperCase();
  const rpMatch = raw.match(/RP-(\d+)/);
  if (rpMatch) return `RP-${Number(rpMatch[1])}`;
  if (/^\d+$/.test(raw)) return `RP-${Number(raw)}`;
  return "";
}

function extractRpCodes(text: string): string[] {
  const normalized = norm(text);
  if (!normalized) return [];
  const upper = normalized.toUpperCase().replace(/[\u2013\u2014]/g, "-");
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (fragment: string) => {
    const code = normalizeRpCode(fragment);
    if (!code || seen.has(code)) return;
    seen.add(code);
    out.push(code);
  };

  const flex = /RP\s*[-]?\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = flex.exec(upper)) !== null) add(`RP-${m[1]}`);

  const attached = /(?:^|[^A-Z0-9])RP(\d{3,8})(?![0-9])/g;
  while ((m = attached.exec(upper)) !== null) add(`RP-${m[1]}`);

  for (const legacy of upper.match(/RP-\d+/g) ?? []) add(legacy);
  return out;
}

function normalizePalletKey(value: string): string {
  return norm(value).toUpperCase().replace(/\s+/g, "");
}

function extractPalletKeys(text: string): string[] {
  const normalized = norm(text).toUpperCase();
  if (!normalized) return [];
  const parts = normalized.split(/[^A-Z0-9]+/).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = normalizePalletKey(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

type SourceEntry = { rpCodes: string[]; palletKey: string; header: string };

type FreightRow = {
  rpCodes: string[];
  palletKeys: string[];
  rawF: string;
};

async function readSheetRange(
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return (res.data.values ?? []) as string[][];
}

function buildSectionHeaderMap(rows: string[][]): Map<number, string> {
  const out = new Map<number, string>();
  let currentHeader = "";
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const label = norm(row[CONFIG.iznosColSectionLabel]).toLowerCase();
    if (label === CONFIG.sectionLabel.toLowerCase()) {
      const prev = i > 0 ? rows[i - 1] : [];
      currentHeader = norm(prev[CONFIG.iznosColHeader]);
    }
    const absoluteRow = CONFIG.iznosStartRow + i;
    out.set(absoluteRow, currentHeader);
  }
  return out;
}

function buildSourceEntries(
  rows: string[][],
  headerMap: Map<number, string>,
): SourceEntry[] {
  const out: SourceEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rawRp = norm(row[CONFIG.iznosColRpCodes]);
    if (!rawRp) continue;
    const rpCodes = extractRpCodes(rawRp);
    if (!rpCodes.length) continue;
    const palletKey = norm(row[CONFIG.iznosColPallet]);
    if (!palletKey) continue;
    const header = headerMap.get(CONFIG.iznosStartRow + i) ?? "";
    if (!header) continue;
    out.push({ rpCodes, palletKey, header });
  }
  return out;
}

async function buildFreightRows(): Promise<FreightRow[]> {
  const width = Math.max(CONFIG.freightKeyCol, CONFIG.freightRpCol) + 1;
  const range = `${CONFIG.freightSheetName}!A${CONFIG.freightStartRow}:${String.fromCharCode(65 + width - 1)}`;
  const data = await readSheetRange(CONFIG.freightSpreadsheetId, range);
  return data.map((row) => ({
    rpCodes: extractRpCodes(norm(row[CONFIG.freightRpCol])),
    palletKeys: extractPalletKeys(norm(row[CONFIG.freightKeyCol])),
    rawF: norm(row[CONFIG.freightKeyCol]),
  }));
}

function getFreightOutcome(
  entryPallet: string,
  rpCode: string,
  freightRows: FreightRow[],
  sectionHeader: string,
): { canShip: boolean; yTrackingText: string | null } {
  const rowsWithRp = freightRows.filter((fr) => fr.rpCodes.includes(rpCode));
  if (!rowsWithRp.length) {
    return { canShip: false, yTrackingText: null };
  }
  if (rowsWithRp.length > 1) {
    return { canShip: true, yTrackingText: EXPORT_PALLET_NOT_FOUND };
  }
  const only = rowsWithRp[0];
  if (!only.palletKeys.length) {
    return { canShip: true, yTrackingText: EXPORT_PALLET_NOT_FOUND };
  }
  const gKey = normalizePalletKey(entryPallet);
  if (!gKey || !only.palletKeys.includes(gKey)) {
    return { canShip: true, yTrackingText: EXPORT_PALLET_NOT_FOUND };
  }
  return {
    canShip: true,
    yTrackingText: `${sectionHeader} Pallet ${gKey}`,
  };
}

/**
 * Full port of ExportAutomation.js — reads Износ + Freight sheets.
 */
export async function runExportStatusSync(): Promise<{
  synced: number;
  yUpdated: number;
  xUpdated: number;
}> {
  if (!loadServerEnv().GOOGLE_SERVICE_ACCOUNT_JSON) {
    return { synced: 0, yUpdated: 0, xUpdated: 0 };
  }

  const readStart = Math.max(1, CONFIG.iznosStartRow - 1);
  const iznosRange = `${CONFIG.iznosSheetName}!A${readStart}:M`;
  const iznosData = await readSheetRange(
    CONFIG.iznosSpreadsheetId,
    iznosRange,
  );
  const headerRows = iznosData.slice(0, iznosData.length);
  const headerMap = buildSectionHeaderMap(
    headerRows.slice(CONFIG.iznosStartRow - readStart),
  );
  const sourceRows = iznosData.slice(CONFIG.iznosStartRow - readStart);
  const sourceEntries = buildSourceEntries(sourceRows, headerMap);
  const freightRows = await buildFreightRows();

  const rpRows = await prisma.rpRequest.findMany();
  const rpByCode = new Map<string, (typeof rpRows)[number]>();
  for (const row of rpRows) {
    const code = normalizeRpCode(row.rpNum);
    if (code) rpByCode.set(code, row);
  }

  let synced = 0;
  let yUpdated = 0;
  let xUpdated = 0;

  for (const entry of sourceEntries) {
    const outputDefault = `${entry.header} Pallet ${entry.palletKey}`;
    for (const code of entry.rpCodes) {
      const rp = rpByCode.get(code);
      if (!rp) continue;

      const method = norm(rp.shipMethod).toLowerCase();
      if (method !== "pallet" && method !== "container") continue;
      const status = norm(rp.status).toLowerCase();
      if (status === "shipped" && norm(rp.tracking)) continue;

      const fr = getFreightOutcome(
        entry.palletKey,
        code,
        freightRows,
        entry.header,
      );

      const patch: {
        tracking?: string;
        status?: string;
        updatedAt: Date;
      } = { updatedAt: new Date() };

      let changed = false;
      const curY = norm(rp.tracking);
      let yToWrite = "";
      if (fr.yTrackingText) yToWrite = fr.yTrackingText;
      else if (!curY) yToWrite = outputDefault;

      if (yToWrite && yToWrite !== curY) {
        patch.tracking = yToWrite;
        changed = true;
        yUpdated++;
        await prisma.rpExportTrackingRow.upsert({
          where: { rpNum: rp.rpNum },
          create: {
            rpNum: rp.rpNum,
            trackingText: yToWrite,
          },
          update: { trackingText: yToWrite, updatedAt: new Date() },
        });
      }

      if (fr.canShip && status !== "shipped") {
        patch.status = "Shipped";
        changed = true;
        xUpdated++;
      }

      if (!changed) continue;
      await prisma.rpRequest.update({ where: { id: rp.id }, data: patch });
      await enqueueSheetSync("rp", rp.id);
      if (patch.status === "Shipped") {
        await recordLifecycleEvent({
          entityType: "rp",
          entityId: rp.id,
          eventType: "shipped",
          fromStatus: rp.status,
          toStatus: "Shipped",
          actorEmail: null,
          payload: {
            source: "export_sync",
            tracking: patch.tracking ?? rp.tracking,
          },
        });
        void notifyAfterRpMutation(rp.rpNum, "status_changed");
      }
      synced++;
    }
  }

  return { synced, yUpdated, xUpdated };
}
