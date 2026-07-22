import "server-only";

import { prisma } from "@/lib/prisma";
import { getCatalogueData } from "@/lib/reference-data/catalogue";
import { getPanelOptionsByBoothModel } from "@/lib/reference-data/sheets";
import { mapAbbreviationToBoothModel } from "@/lib/domain/rp-form-mapper";
import { loadServerEnv } from "@/lib/env";

export type CataloguePartRow = {
  code: string;
  description: string;
  category: string;
  booth?: string;
  mrpMaterialId: string | null;
  mrpMaterialCode: string | null;
  mrpMaterialName: string | null;
  mapped: boolean;
};

export type CataloguePanelRow = {
  boothModelName: string;
  rpPanelName: string;
  boothElementId: string | null;
  mrpSimpleName: string | null;
  mapped: boolean;
};

export type PartMapRow = {
  id: string;
  partRpCode: string;
  mrpMaterialId: string;
  mrpMaterialCode: string | null;
  mrpMaterialName: string;
  notes: string | null;
};

export type PanelMapRow = {
  id: string;
  boothModelName: string;
  rpPanelName: string;
  boothElementId: string;
  mrpSimpleName: string;
  mrpBoothModelName: string;
  notes: string | null;
};

export type MrpMaterialOption = {
  id: string;
  code: string | null;
  name: string;
};

export type MrpElementOption = {
  id: string;
  boothModelName: string;
  simpleName: string;
};

export type ReadyUndeductedRow = {
  lineItemId: string;
  kind: "part" | "panel";
  rpNum: string;
  model: string | null;
  reviewGroup: string | null;
  partRpCode: string | null;
  panelName: string | null;
  quantity: string | null;
  fulfillment: string;
  materialsDeductionError: string | null;
};

function normalizePartCode(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export async function listCatalogueParts(): Promise<CataloguePartRow[]> {
  let categories;
  try {
    categories = await getCatalogueData();
  } catch (error) {
    console.error("[catalogue-mrp] parts list:", error);
    return [];
  }
  const [maps, materialsByCode] = await Promise.all([
    prisma.rpPartMrpMap.findMany({
      select: {
        partRpCode: true,
        mrpMaterialId: true,
        mrpMaterial: { select: { code: true, name: true } },
      },
    }),
    prisma.mrpMaterial.findMany({
      where: { isActive: true, code: { not: null } },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const mapByCode = new Map(
    maps.map((m) => [normalizePartCode(m.partRpCode), m]),
  );
  const materialByCode = new Map(
    materialsByCode
      .filter((m) => m.code)
      .map((m) => [normalizePartCode(m.code), m]),
  );

  const rows: CataloguePartRow[] = [];
  const seen = new Set<string>();

  for (const cat of categories) {
    for (const row of cat.rows) {
      const code = normalizePartCode(row.code);
      if (!/^\d{4}$/.test(code) || seen.has(code)) continue;
      seen.add(code);
      const mapped = mapByCode.get(code);
      const fallback = !mapped ? materialByCode.get(code) : null;
      rows.push({
        code,
        description: row.description ?? "",
        category: cat.category,
        booth: row.booth,
        mrpMaterialId: mapped?.mrpMaterialId ?? fallback?.id ?? null,
        mrpMaterialCode:
          mapped?.mrpMaterial.code ?? fallback?.code ?? null,
        mrpMaterialName:
          mapped?.mrpMaterial.name ?? fallback?.name ?? null,
        mapped: Boolean(mapped) || Boolean(fallback),
      });
    }
  }

  rows.sort((a, b) => a.code.localeCompare(b.code));
  return rows;
}

export async function listCataloguePanels(): Promise<CataloguePanelRow[]> {
  const [panelPayload, maps, elements] = await Promise.all([
    getPanelOptionsByBoothModel(),
    prisma.rpPanelMrpMap.findMany({
      select: {
        boothModelName: true,
        rpPanelName: true,
        boothElementId: true,
        boothElement: { select: { simpleName: true } },
      },
    }),
    prisma.mrpBoothElement.findMany({
      where: { isActive: true },
      select: {
        id: true,
        simpleName: true,
        boothModel: { select: { name: true } },
      },
    }),
  ]);

  const mapKey = (model: string, panel: string) =>
    `${model.trim().toLowerCase()}\0${panel.trim().toLowerCase()}`;

  const mapByKey = new Map(
    maps.map((m) => [
      mapKey(m.boothModelName, m.rpPanelName),
      m,
    ]),
  );

  const elementByKey = new Map(
    elements.map((e) => [
      mapKey(e.boothModel.name, e.simpleName),
      e,
    ]),
  );

  const rows: CataloguePanelRow[] = [];
  for (const [modelHeader, options] of Object.entries(
    panelPayload.modelOptions,
  )) {
    const boothModelName =
      mapAbbreviationToBoothModel(modelHeader) || modelHeader;
    for (const rpPanelName of options) {
      const mapped = mapByKey.get(mapKey(boothModelName, rpPanelName));
      const exact = elementByKey.get(mapKey(boothModelName, rpPanelName));
      rows.push({
        boothModelName,
        rpPanelName,
        boothElementId: mapped?.boothElementId ?? exact?.id ?? null,
        mrpSimpleName:
          mapped?.boothElement.simpleName ?? exact?.simpleName ?? null,
        mapped: Boolean(mapped) || Boolean(exact),
      });
    }
  }

  rows.sort(
    (a, b) =>
      a.boothModelName.localeCompare(b.boothModelName) ||
      a.rpPanelName.localeCompare(b.rpPanelName),
  );
  return rows;
}

export async function listPartMaps(): Promise<PartMapRow[]> {
  const rows = await prisma.rpPartMrpMap.findMany({
    include: { mrpMaterial: { select: { code: true, name: true } } },
    orderBy: { partRpCode: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    partRpCode: r.partRpCode,
    mrpMaterialId: r.mrpMaterialId,
    mrpMaterialCode: r.mrpMaterial.code,
    mrpMaterialName: r.mrpMaterial.name,
    notes: r.notes,
  }));
}

export async function listPanelMaps(): Promise<PanelMapRow[]> {
  const rows = await prisma.rpPanelMrpMap.findMany({
    include: {
      boothElement: {
        select: {
          simpleName: true,
          boothModel: { select: { name: true } },
        },
      },
    },
    orderBy: [{ boothModelName: "asc" }, { rpPanelName: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    boothModelName: r.boothModelName,
    rpPanelName: r.rpPanelName,
    boothElementId: r.boothElementId,
    mrpSimpleName: r.boothElement.simpleName,
    mrpBoothModelName: r.boothElement.boothModel.name,
    notes: r.notes,
  }));
}

export async function listMrpMaterialOptions(): Promise<MrpMaterialOption[]> {
  const rows = await prisma.mrpMaterial.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    take: 5000,
  });
  return rows;
}

export async function listMrpElementOptions(): Promise<MrpElementOption[]> {
  const rows = await prisma.mrpBoothElement.findMany({
    where: { isActive: true },
    select: {
      id: true,
      simpleName: true,
      boothModel: { select: { name: true } },
    },
    orderBy: [
      { boothModel: { name: "asc" } },
      { sortOrder: "asc" },
      { simpleName: "asc" },
    ],
  });
  return rows.map((r) => ({
    id: r.id,
    boothModelName: r.boothModel.name,
    simpleName: r.simpleName,
  }));
}

export async function upsertPartMap(input: {
  partRpCode: string;
  mrpMaterialId: string;
  notes?: string | null;
}): Promise<void> {
  const partRpCode = normalizePartCode(input.partRpCode);
  if (!/^\d{4}$/.test(partRpCode)) {
    throw new Error("Part RP code must be 4 digits");
  }
  await prisma.rpPartMrpMap.upsert({
    where: { partRpCode },
    create: {
      partRpCode,
      mrpMaterialId: input.mrpMaterialId,
      notes: input.notes ?? null,
    },
    update: {
      mrpMaterialId: input.mrpMaterialId,
      notes: input.notes ?? null,
    },
  });
}

export async function deletePartMap(id: string): Promise<void> {
  await prisma.rpPartMrpMap.delete({ where: { id } });
}

export async function upsertPanelMap(input: {
  boothModelName: string;
  rpPanelName: string;
  boothElementId: string;
  notes?: string | null;
}): Promise<void> {
  const boothModelName = input.boothModelName.trim();
  const rpPanelName = input.rpPanelName.trim();
  if (!boothModelName || !rpPanelName) {
    throw new Error("Booth model and panel name are required");
  }
  await prisma.rpPanelMrpMap.upsert({
    where: {
      boothModelName_rpPanelName: { boothModelName, rpPanelName },
    },
    create: {
      boothModelName,
      rpPanelName,
      boothElementId: input.boothElementId,
      notes: input.notes ?? null,
    },
    update: {
      boothElementId: input.boothElementId,
      notes: input.notes ?? null,
    },
  });
}

export async function deletePanelMap(id: string): Promise<void> {
  await prisma.rpPanelMrpMap.delete({ where: { id } });
}

/** Create map rows where RP part code equals an active MRP material code. */
export async function bulkLinkPartsByEqualCode(): Promise<{ linked: number }> {
  const [maps, materials] = await Promise.all([
    prisma.rpPartMrpMap.findMany({ select: { partRpCode: true } }),
    prisma.mrpMaterial.findMany({
      where: { isActive: true, code: { not: null } },
      select: { id: true, code: true },
    }),
  ]);
  const existing = new Set(maps.map((m) => normalizePartCode(m.partRpCode)));
  const catalogue = await listCatalogueParts();
  const materialByCode = new Map(
    materials
      .filter((m) => m.code)
      .map((m) => [normalizePartCode(m.code), m.id]),
  );

  let linked = 0;
  for (const part of catalogue) {
    if (existing.has(part.code)) continue;
    const materialId = materialByCode.get(part.code);
    if (!materialId) continue;
    await prisma.rpPartMrpMap.create({
      data: {
        partRpCode: part.code,
        mrpMaterialId: materialId,
        notes: "auto: equal code",
      },
    });
    linked++;
  }
  return { linked };
}

/** Seed panel maps where RP panel name equals MRP simpleName on the same model. */
export async function seedExactMatchPanelMaps(): Promise<{
  linked: number;
  skipped: number;
}> {
  const panels = await listCataloguePanels();
  const elements = await prisma.mrpBoothElement.findMany({
    where: { isActive: true },
    select: {
      id: true,
      simpleName: true,
      boothModel: { select: { name: true } },
    },
  });
  const key = (model: string, name: string) =>
    `${model.trim().toLowerCase()}\0${name.trim().toLowerCase()}`;
  const elementByKey = new Map(
    elements.map((e) => [key(e.boothModel.name, e.simpleName), e.id]),
  );

  let linked = 0;
  let skipped = 0;
  for (const panel of panels) {
    if (panel.mapped && panel.boothElementId) {
      // Ensure explicit map row exists for exact matches shown as mapped via fallback
      const existing = await prisma.rpPanelMrpMap.findUnique({
        where: {
          boothModelName_rpPanelName: {
            boothModelName: panel.boothModelName,
            rpPanelName: panel.rpPanelName,
          },
        },
      });
      if (existing) {
        skipped++;
        continue;
      }
    }
    const elementId = elementByKey.get(
      key(panel.boothModelName, panel.rpPanelName),
    );
    if (!elementId) {
      skipped++;
      continue;
    }
    await prisma.rpPanelMrpMap.upsert({
      where: {
        boothModelName_rpPanelName: {
          boothModelName: panel.boothModelName,
          rpPanelName: panel.rpPanelName,
        },
      },
      create: {
        boothModelName: panel.boothModelName,
        rpPanelName: panel.rpPanelName,
        boothElementId: elementId,
        notes: "auto: exact simpleName match",
      },
      update: {},
    });
    linked++;
  }
  return { linked, skipped };
}

export async function listReadyUndeductedLines(
  limit = 200,
): Promise<ReadyUndeductedRow[]> {
  const lines = await prisma.rpLineItem.findMany({
    where: {
      materialsDeductedAt: null,
      rpRequest: { status: "Ready" },
      NOT: { kind: "panel", fulfillment: "from_stock" },
    },
    include: {
      rpRequest: {
        select: {
          rpNum: true,
          model: true,
          reviewGroup: true,
          partRpCode: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return lines.map((l) => ({
    lineItemId: l.id,
    kind: l.kind,
    rpNum: l.rpRequest.rpNum,
    model: l.rpRequest.model,
    reviewGroup: l.rpRequest.reviewGroup,
    partRpCode: l.partRpCode ?? l.rpRequest.partRpCode,
    panelName: l.panelName,
    quantity: l.quantity,
    fulfillment: l.fulfillment,
    materialsDeductionError: l.materialsDeductionError,
  }));
}

export type DeductApiResult = {
  posted: number;
  skipped: number;
  errors: number;
  results: Array<{
    rpLineItemId: string;
    rpNum: string;
    status: string;
    message?: string;
    movementsPosted?: number;
  }>;
};

/** Call MRP POST /api/stock/rp-deduct with shared secret. */
export async function callMrpDeduct(input: {
  rpLineItemIds?: string[];
  rpRequestId?: string;
}): Promise<DeductApiResult> {
  const env = loadServerEnv();
  const baseUrl =
    (env.MRP_APP_URL ?? process.env.MRP_APP_URL ?? "https://mrp.meavo.app").replace(
      /\/$/,
      "",
    );
  const secret = env.RP_MRP_DEDUCT_SECRET ?? process.env.RP_MRP_DEDUCT_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("RP_MRP_DEDUCT_SECRET is not configured");
  }

  const res = await fetch(`${baseUrl}/api/stock/rp-deduct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MRP deduct failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return (await res.json()) as DeductApiResult;
}
