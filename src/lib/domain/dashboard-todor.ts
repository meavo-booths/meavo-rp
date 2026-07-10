import { prisma } from "@/lib/prisma";
import { getSheetsClient } from "@/lib/integrations/sheets-client";

const IZNOS_CONFIG = {
  spreadsheetId:
    process.env.IZNOS_SPREADSHEET_ID ??
    "1ek1j6DFfTd4BfdI1MiPQedg0jr-V1VoYKHTpXW4DaKs",
  sheetName: "Износ",
  startRow: 3583,
  colPallet: 6,
  colRpCodes: 12,
  colSectionLabel: 12,
  colHeader: 0,
  sectionLabel: "Резервни части",
};

export type TodorIpCard = {
  ipNum: string;
  panel: string | null;
  batch: string | null;
  warehouse: string | null;
  status: string | null;
  factory: string | null;
};

export type TodorScheduleEntry = {
  rpNum: string;
  rpCode: string;
  pallet: string;
  header: string;
  isoWeek?: number;
  isoYear?: number;
};

export type TodorDashboardPart = {
  rpNum: string;
  market: string | null;
  status: string | null;
  shipMethod: string | null;
  reviewGroup: string | null;
  pallet?: string | null;
  source: "iznos" | "warehouse" | "ip" | "rp";
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeRpCode(value: string): string {
  const raw = norm(value).toUpperCase();
  const m = raw.match(/RP-(\d+)/);
  if (m) return `RP-${Number(m[1])}`;
  if (/^\d+$/.test(raw)) return `RP-${Number(raw)}`;
  return raw;
}

function extractRpCodes(text: string): string[] {
  const upper = norm(text).toUpperCase().replace(/[\u2013\u2014]/g, "-");
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (code: string) => {
    const n = normalizeRpCode(code);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  const flex = /RP\s*[-]?\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = flex.exec(upper)) !== null) add(`RP-${m[1]}`);
  for (const legacy of upper.match(/RP-\d+/g) ?? []) add(legacy);
  return out;
}

function getIsoWeekContext(date = new Date()): { weekNum: number; isoYear: number } {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return { weekNum, isoYear: d.getFullYear() };
}

async function readIznosRows(): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const readStart = Math.max(1, IZNOS_CONFIG.startRow - 1);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: IZNOS_CONFIG.spreadsheetId,
    range: `${IZNOS_CONFIG.sheetName}!A${readStart}:M`,
  });
  return (res.data.values ?? []) as string[][];
}

export async function buildIznosRpScheduleEntries(): Promise<TodorScheduleEntry[]> {
  try {
    const data = await readIznosRows();
    const body = data.slice(IZNOS_CONFIG.startRow - Math.max(1, IZNOS_CONFIG.startRow - 1));
    let currentHeader = "";
    const out: TodorScheduleEntry[] = [];
    const ctx = getIsoWeekContext();

    for (let i = 0; i < body.length; i++) {
      const row = body[i] ?? [];
      const label = norm(row[IZNOS_CONFIG.colSectionLabel]).toLowerCase();
      if (label === IZNOS_CONFIG.sectionLabel.toLowerCase()) {
        const prev = i > 0 ? body[i - 1] : [];
        currentHeader = norm(prev[IZNOS_CONFIG.colHeader]);
      }
      const rawRp = norm(row[IZNOS_CONFIG.colRpCodes]);
      if (!rawRp || !currentHeader) continue;
      const codes = extractRpCodes(rawRp);
      const pallet = norm(row[IZNOS_CONFIG.colPallet]);
      if (!pallet) continue;
      for (const code of codes) {
        out.push({
          rpNum: code,
          rpCode: code,
          pallet,
          header: currentHeader,
          isoWeek: ctx.weekNum,
          isoYear: ctx.isoYear,
        });
      }
    }
    return out;
  } catch (error) {
    console.error("buildIznosRpScheduleEntries failed:", error);
    return [];
  }
}

export async function getTodorTopoliIpCards(): Promise<TodorIpCard[]> {
  const rows = await prisma.rpInternalProductionRow.findMany({
    where: {
      warehouse: { contains: "topoli", mode: "insensitive" },
    },
    orderBy: { ipNum: "desc" },
  });
  return rows.map((r) => ({
    ipNum: r.ipNum,
    panel: r.panel,
    batch: r.batch,
    warehouse: r.warehouse,
    status: r.status,
    factory: r.factory,
  }));
}

async function buildRpDetailsIndex(): Promise<Map<string, TodorDashboardPart>> {
  const rows = await prisma.rpRequest.findMany({
    select: {
      rpNum: true,
      market: true,
      status: true,
      shipMethod: true,
      reviewGroup: true,
    },
  });
  const map = new Map<string, TodorDashboardPart>();
  for (const row of rows) {
    const key = normalizeRpCode(row.rpNum);
    map.set(key, {
      rpNum: row.rpNum,
      market: row.market,
      status: row.status,
      shipMethod: row.shipMethod,
      reviewGroup: row.reviewGroup,
      source: "rp",
    });
  }
  return map;
}

export async function getTodorDashboardParts(
  view: "iznos" | "all" | "availability" | "ip" | "cancelled",
  week: "this" | "next" = "this",
): Promise<TodorDashboardPart[]> {
  if (view === "availability") {
    const ips = await getTodorTopoliIpCards();
    return ips.map((ip) => ({
      rpNum: ip.ipNum,
      market: null,
      status: ip.status,
      shipMethod: null,
      reviewGroup: ip.factory,
      source: "warehouse" as const,
    }));
  }

  if (view === "ip") {
    const ips = await getTodorTopoliIpCards();
    return ips.map((ip) => ({
      rpNum: ip.ipNum,
      market: null,
      status: ip.status,
      shipMethod: null,
      reviewGroup: ip.factory,
      source: "ip" as const,
    }));
  }

  const schedule = await buildIznosRpScheduleEntries();
  const details = await buildRpDetailsIndex();
  const parts: TodorDashboardPart[] = [];

  for (const entry of schedule) {
    const detail = details.get(entry.rpCode);
    parts.push({
      rpNum: entry.rpNum,
      market: detail?.market ?? null,
      status: detail?.status ?? null,
      shipMethod: detail?.shipMethod ?? null,
      reviewGroup: detail?.reviewGroup ?? null,
      pallet: entry.pallet,
      source: "iznos",
    });
  }

  if (view === "all") {
    const ips = await getTodorTopoliIpCards();
    for (const ip of ips) {
      parts.push({
        rpNum: ip.ipNum,
        market: null,
        status: ip.status,
        shipMethod: null,
        reviewGroup: ip.factory,
        source: "ip",
      });
    }
    const seen = new Set<string>();
    return parts.filter((p) => {
      const key = p.rpNum.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (view === "cancelled") {
    return parts.filter((p) => norm(p.status).toLowerCase() === "cancelled");
  }

  return parts;
}

/** @deprecated use getTodorDashboardParts */
export async function getTodorExportRpRows(week: "this" | "next"): Promise<
  {
    rpNum: string;
    market: string | null;
    status: string | null;
    shipMethod: string | null;
    reviewGroup: string | null;
  }[]
> {
  const parts = await getTodorDashboardParts("iznos", week);
  return parts.map(({ rpNum, market, status, shipMethod, reviewGroup }) => ({
    rpNum,
    market,
    status,
    shipMethod,
    reviewGroup,
  }));
}
