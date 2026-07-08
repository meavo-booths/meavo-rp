import { loadServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  columnLetter,
  getRepPartsSpreadsheetId,
  getSheetsClient,
} from "@/lib/integrations/sheets-client";
import {
  IP_LAST_COLUMN,
  RP_LAST_COLUMN,
} from "@/lib/integrations/rp-sheet-columns";
import {
  ipRowToSheetRow,
  rpRequestToSheetRow,
} from "@/lib/integrations/sheet-row-mapper";

const BATCH_SIZE = 25;

export type SheetSyncResult = {
  processed: number;
  synced: number;
  failed: number;
  errors: string[];
};

async function findSheetRow(
  entityType: "rp" | "ip",
  entityId: string,
  sheetName: string,
): Promise<number | null> {
  const map = await prisma.rpSheetRowMap.findFirst({
    where: { entityType, entityId, sheetName },
  });
  return map?.rowNumber ?? null;
}

async function upsertSheetRowMap(
  entityType: "rp" | "ip",
  entityId: string,
  sheetName: string,
  rowNumber: number,
): Promise<void> {
  const existing = await prisma.rpSheetRowMap.findFirst({
    where: { entityType, entityId, sheetName },
  });

  if (existing) {
    await prisma.rpSheetRowMap.update({
      where: { id: existing.id },
      data: { rowNumber, updatedAt: new Date() },
    });
    return;
  }

  await prisma.rpSheetRowMap.create({
    data: { entityType, entityId, sheetName, rowNumber },
  });
}

export async function processSheetSyncOutbox(): Promise<SheetSyncResult> {
  const env = loadServerEnv();
  if (!env.REP_PARTS_SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      processed: 0,
      synced: 0,
      failed: 0,
      errors: ["Sheets backup not configured"],
    };
  }

  const pending = await prisma.rpSheetSyncOutbox.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (!pending.length) {
    return { processed: 0, synced: 0, failed: 0, errors: [] };
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = getRepPartsSpreadsheetId();
  const rpSheetName = env.REP_PARTS_SHEET_NAME;
  const ipSheetName = env.INTERNAL_PRODUCTION_SHEET_NAME;

  const ids = pending.map((p) => p.id);
  await prisma.rpSheetSyncOutbox.updateMany({
    where: { id: { in: ids } },
    data: { status: "processing" },
  });

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of pending) {
    try {
      if (item.entityType === "rp") {
        const row = await prisma.rpRequest.findUnique({
          where: { id: item.entityId },
        });
        if (!row) throw new Error(`RP ${item.entityId} not found`);

        const values = [rpRequestToSheetRow(row)];
        let rowNumber = await findSheetRow("rp", item.entityId, rpSheetName);

        if (rowNumber) {
          const endCol = columnLetter(RP_LAST_COLUMN);
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${rpSheetName}!A${rowNumber}:${endCol}${rowNumber}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values },
          });
        } else {
          const append = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${rpSheetName}!A:A`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values },
          });
          const updatedRange = append.data.updates?.updatedRange ?? "";
          const match = updatedRange.match(/!A(\d+)/i);
          if (!match) throw new Error("Could not parse appended row number");
          rowNumber = Number(match[1]);
          await upsertSheetRowMap("rp", item.entityId, rpSheetName, rowNumber);
        }

        await prisma.rpRequest.update({
          where: { id: item.entityId },
          data: { syncedAt: new Date() },
        });
      } else if (item.entityType === "ip") {
        const row = await prisma.rpInternalProductionRow.findUnique({
          where: { id: item.entityId },
        });
        if (!row) throw new Error(`IP ${item.entityId} not found`);

        const values = [ipRowToSheetRow(row)];
        let rowNumber = await findSheetRow("ip", item.entityId, ipSheetName);

        if (rowNumber) {
          const endCol = columnLetter(IP_LAST_COLUMN);
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${ipSheetName}!A${rowNumber}:${endCol}${rowNumber}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values },
          });
        } else {
          const append = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${ipSheetName}!A:A`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values },
          });
          const updatedRange = append.data.updates?.updatedRange ?? "";
          const match = updatedRange.match(/!A(\d+)/i);
          if (!match) throw new Error("Could not parse appended row number");
          rowNumber = Number(match[1]);
          await upsertSheetRowMap("ip", item.entityId, ipSheetName, rowNumber);
        }

        await prisma.rpInternalProductionRow.update({
          where: { id: item.entityId },
          data: { syncedAt: new Date() },
        });
      } else {
        throw new Error(`Unknown entity type: ${item.entityType}`);
      }

      await prisma.rpSheetSyncOutbox.update({
        where: { id: item.id },
        data: {
          status: "synced",
          processedAt: new Date(),
          attempts: item.attempts + 1,
          lastError: null,
        },
      });
      synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${item.id}: ${message}`);
      await prisma.rpSheetSyncOutbox.update({
        where: { id: item.id },
        data: {
          status: "failed",
          attempts: item.attempts + 1,
          lastError: message,
          processedAt: new Date(),
        },
      });
      failed++;
    }
  }

  return {
    processed: pending.length,
    synced,
    failed,
    errors,
  };
}
