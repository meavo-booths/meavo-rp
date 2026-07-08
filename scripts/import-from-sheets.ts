/**
 * One-time import: Rep.Parts26 + Internal Production → shared Neon DB.
 * Run: npm run import:sheets
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON, REP_PARTS_SPREADSHEET_ID, DATABASE_URL.
 */

import { config } from "dotenv";
import { resolve } from "node:path";

import { seedIpNumSequenceFromExisting } from "../src/lib/domain/ip-numbers";
import { seedRpNumSequenceFromExisting } from "../src/lib/domain/rp-numbers";
import {
  backfillStockReplacementLinks,
  upsertRpLineItemsFromRow,
} from "../src/lib/domain/rp-line-item-sync";
import { loadServerEnv } from "../src/lib/env";
import {
  columnLetter,
  getRepPartsSpreadsheetId,
  getSheetsClient,
} from "../src/lib/integrations/sheets-client";
import {
  IP_LAST_COLUMN,
  RP_LAST_COLUMN,
} from "../src/lib/integrations/rp-sheet-columns";
import {
  sheetRowToIpRow,
  sheetRowToRpRequest,
} from "../src/lib/integrations/sheet-row-mapper";
import { prisma } from "../src/lib/prisma";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

type ImportStats = {
  rpImported: number;
  rpSkipped: number;
  ipImported: number;
  ipSkipped: number;
  lineItemsCreated: number;
  stockLinksLinked: number;
  stockLinksAmbiguous: number;
  errors: string[];
};

async function readSheetRows(
  sheetName: string,
  lastCol: number,
): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getRepPartsSpreadsheetId();
  const endCol = columnLetter(lastCol);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:${endCol}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (response.data.values ?? []) as string[][];
}

async function importRpSheet(
  sheetName: string,
  stats: ImportStats,
): Promise<void> {
  const rows = await readSheetRows(sheetName, RP_LAST_COLUMN);

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const parsed = sheetRowToRpRequest(rows[i], rowNumber);
    if (!parsed) {
      stats.rpSkipped++;
      continue;
    }

    try {
      const existing = await prisma.rpRequest.findUnique({
        where: { rpNum: parsed.rpNum },
        select: { id: true },
      });

      let entityId: string;
      let rpRow;
      if (existing) {
        rpRow = await prisma.rpRequest.update({
          where: { id: existing.id },
          data: { ...parsed.data, updatedAt: new Date() },
        });
        entityId = existing.id;
      } else {
        rpRow = await prisma.rpRequest.create({ data: parsed.data });
        entityId = rpRow.id;
      }

      const lineItemIds = await upsertRpLineItemsFromRow(entityId, rpRow);
      stats.lineItemsCreated += lineItemIds.length;

      const map = await prisma.rpSheetRowMap.findFirst({
        where: { entityId },
      });

      if (map) {
        await prisma.rpSheetRowMap.update({
          where: { id: map.id },
          data: {
            entityType: "rp",
            sheetName,
            rowNumber: parsed.rowNumber,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.rpSheetRowMap.create({
          data: {
            entityType: "rp",
            entityId,
            sheetName,
            rowNumber: parsed.rowNumber,
          },
        });
      }

      stats.rpImported++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stats.errors.push(`RP row ${rowNumber} (${parsed.rpNum}): ${message}`);
    }
  }
}

async function importIpSheet(
  sheetName: string,
  stats: ImportStats,
): Promise<void> {
  const rows = await readSheetRows(sheetName, IP_LAST_COLUMN);

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const parsed = sheetRowToIpRow(rows[i], rowNumber);
    if (!parsed) {
      stats.ipSkipped++;
      continue;
    }

    try {
      const existing = await prisma.rpInternalProductionRow.findUnique({
        where: { ipNum: parsed.ipNum },
        select: { id: true },
      });

      let entityId: string;
      if (existing) {
        await prisma.rpInternalProductionRow.update({
          where: { id: existing.id },
          data: { ...parsed.data, updatedAt: new Date() },
        });
        entityId = existing.id;
      } else {
        const inserted = await prisma.rpInternalProductionRow.create({
          data: parsed.data,
        });
        entityId = inserted.id;
      }

      const map = await prisma.rpSheetRowMap.findFirst({
        where: { entityId },
      });

      if (map) {
        await prisma.rpSheetRowMap.update({
          where: { id: map.id },
          data: {
            entityType: "ip",
            sheetName,
            rowNumber: parsed.rowNumber,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.rpSheetRowMap.create({
          data: {
            entityType: "ip",
            entityId,
            sheetName,
            rowNumber: parsed.rowNumber,
          },
        });
      }

      stats.ipImported++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stats.errors.push(`IP row ${rowNumber} (${parsed.ipNum}): ${message}`);
    }
  }
}

async function main() {
  const env = loadServerEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!env.REP_PARTS_SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      "REP_PARTS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON are required",
    );
  }

  console.log("Importing from spreadsheet:", env.REP_PARTS_SPREADSHEET_ID);
  const stats: ImportStats = {
    rpImported: 0,
    rpSkipped: 0,
    ipImported: 0,
    ipSkipped: 0,
    lineItemsCreated: 0,
    stockLinksLinked: 0,
    stockLinksAmbiguous: 0,
    errors: [],
  };

  await importRpSheet(env.REP_PARTS_SHEET_NAME, stats);
  await importIpSheet(env.INTERNAL_PRODUCTION_SHEET_NAME, stats);

  const backfill = await backfillStockReplacementLinks();
  stats.stockLinksLinked = backfill.linked;
  stats.stockLinksAmbiguous = backfill.ambiguous;
  await seedIpNumSequenceFromExisting();
  await seedRpNumSequenceFromExisting();

  console.log("\nImport complete:");
  console.log(`  RP rows imported: ${stats.rpImported}`);
  console.log(`  RP rows skipped (empty): ${stats.rpSkipped}`);
  console.log(`  Line items created: ${stats.lineItemsCreated}`);
  console.log(`  IP rows imported: ${stats.ipImported}`);
  console.log(`  IP rows skipped (empty): ${stats.ipSkipped}`);
  console.log(`  Stock replacement links: ${stats.stockLinksLinked}`);
  if (stats.stockLinksAmbiguous) {
    console.log(
      `  Ambiguous stock links (need manual reconcile): ${stats.stockLinksAmbiguous}`,
    );
  }
  if (stats.errors.length) {
    console.log(`  Errors: ${stats.errors.length}`);
    for (const err of stats.errors.slice(0, 20)) {
      console.log(`    - ${err}`);
    }
    if (stats.errors.length > 20) {
      console.log(`    ... and ${stats.errors.length - 20} more`);
    }
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
