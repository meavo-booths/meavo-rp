/**
 * Seed RpPanelMrpMap rows where RP panel name equals MRP booth-element simpleName
 * on the same booth model.
 *
 * Usage (from Meavo-RP-App, with DATABASE_URL set):
 *   npx tsx scripts/seed-panel-mrp-maps.ts
 *
 * Remaining unmatched RP panels must be linked manually in /catalogue → Mappings.
 */
import { PrismaClient } from "@prisma/client";

import { getPanelOptionsByBoothModel } from "../src/lib/reference-data/sheets";
import { mapAbbreviationToBoothModel } from "../src/lib/domain/rp-form-mapper";

const prisma = new PrismaClient();

function key(model: string, name: string) {
  return `${model.trim().toLowerCase()}\0${name.trim().toLowerCase()}`;
}

async function main() {
  const [panelPayload, elements, existing] = await Promise.all([
    getPanelOptionsByBoothModel(),
    prisma.mrpBoothElement.findMany({
      where: { isActive: true },
      select: {
        id: true,
        simpleName: true,
        boothModel: { select: { name: true } },
      },
    }),
    prisma.rpPanelMrpMap.findMany({
      select: { boothModelName: true, rpPanelName: true },
    }),
  ]);

  const elementByKey = new Map(
    elements.map((e) => [key(e.boothModel.name, e.simpleName), e]),
  );
  const existingKeys = new Set(
    existing.map((m) => key(m.boothModelName, m.rpPanelName)),
  );

  let linked = 0;
  const unmatched: string[] = [];

  for (const [modelHeader, options] of Object.entries(
    panelPayload.modelOptions,
  )) {
    const boothModelName =
      mapAbbreviationToBoothModel(modelHeader) || modelHeader;
    for (const rpPanelName of options) {
      const k = key(boothModelName, rpPanelName);
      if (existingKeys.has(k)) continue;
      const el = elementByKey.get(k);
      if (!el) {
        unmatched.push(`${boothModelName} / ${rpPanelName}`);
        continue;
      }
      await prisma.rpPanelMrpMap.create({
        data: {
          boothModelName,
          rpPanelName,
          boothElementId: el.id,
          notes: "auto: exact simpleName match",
        },
      });
      linked++;
      existingKeys.add(k);
    }
  }

  console.log(`Linked ${linked} exact panel matches.`);
  console.log(`Unmatched (need manual map): ${unmatched.length}`);
  for (const row of unmatched.slice(0, 50)) {
    console.log(`  - ${row}`);
  }
  if (unmatched.length > 50) {
    console.log(`  … and ${unmatched.length - 50} more`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
