import type { RpRequest } from "@prisma/client";

import {
  collectFactoryPanelsForOrder,
  type PanelOrderEntry,
} from "@/lib/domain/panel-order-collect";
import { prisma } from "@/lib/prisma";

export type AdminIssueRow = {
  rpNum: string;
  market: string | null;
  itemType: string | null;
  boothId: string | null;
  reviewGroup: string | null;
  dueDate: string | null;
  status: string | null;
  urgency: string;
  issues: string[];
};

export type AdminDelayedRow = {
  rpNum: string;
  recordType: "rp" | "ip";
  dueDate: string | null;
  overdueDays: number;
  status: string | null;
  reviewGroup: string | null;
  itemType: string | null;
  notes: string | null;
};

export type AdminPanelRow = {
  recordType: "rp" | "ip";
  recordId: string;
  num: string;
  factory: string;
  description: string;
  workshopNote: string | null;
  dueDate: string | null;
  urgency: string;
  status: string | null;
  issueType: string | null;
  boothId: string | null;
  model: string | null;
  color: string | null;
  market: string | null;
  clarifications: string | null;
  notes: string | null;
  payer: string | null;
  orderSentAt?: string | null;
};

export type AdminDashboardData = {
  issues: AdminIssueRow[];
  delayed: AdminDelayedRow[];
  unsentKaz: AdminPanelRow[];
  unsentVar: AdminPanelRow[];
  recentKaz: AdminPanelRow[];
  recentVar: AdminPanelRow[];
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isPartLine(itemType: string | null | undefined): boolean {
  const k = norm(itemType).toUpperCase();
  return (
    k === "PART" ||
    k === "PARTS" ||
    k === "STOCK" ||
    k === "SPARE" ||
    k.includes("OTHER PARTS")
  );
}

function isPanelRow(itemType: string | null | undefined): boolean {
  return !isPartLine(itemType);
}

function isTerminalStatus(status: string | null | undefined): boolean {
  const s = norm(status).toLowerCase();
  return (
    s === "cancelled" ||
    s === "shipped" ||
    s === "ordered on amazon"
  );
}

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toStartOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getOverdueDays(value: Date | null | undefined): number | null {
  if (!value) return null;
  const diffMs = startOfToday().getTime() - toStartOfDay(value).getTime();
  if (diffMs <= 0) return null;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function hasMeaningfulRpData(row: RpRequest): boolean {
  return [
    row.entryDate,
    row.dueDate,
    row.market,
    row.issueType,
    row.model,
    row.boothId,
    row.color,
    row.itemType,
    row.partDescription,
    row.clarifications,
    row.notes,
    row.client,
    row.address,
    row.recipient,
    row.phone,
    row.email,
    row.reviewGroup,
    row.shipMethod,
    row.status,
    row.tracking,
    row.payer,
    row.currentLocation,
    row.workshopNote,
    row.orderSentAt,
  ].some((value) => {
    if (value instanceof Date) return true;
    return norm(String(value ?? "")) !== "";
  });
}

function panelEntryToRow(entry: PanelOrderEntry): AdminPanelRow {
  return {
    recordType: entry.recordType,
    recordId: entry.recordId,
    num: entry.rpNum,
    factory: entry.factory,
    description: entry.partDescription ?? entry.itemType ?? "",
    workshopNote: entry.workshopNote,
    dueDate: formatDate(entry.dueDate),
    urgency: entry.urgency,
    status: entry.status,
    issueType: entry.issueType ?? null,
    boothId: entry.boothId ?? null,
    model: entry.model ?? null,
    color: entry.color ?? null,
    market: entry.market ?? null,
    clarifications: entry.clarifications ?? null,
    notes: entry.notes ?? null,
    payer: entry.payer ?? null,
  };
}

function detectRpIssues(row: RpRequest): string[] {
  if (!hasMeaningfulRpData(row)) return [];
  if (!isPanelRow(row.itemType)) return [];
  if (isTerminalStatus(row.status)) return [];

  const issues: string[] = [];
  const factory = norm(row.reviewGroup).toUpperCase();

  if (!factory || factory === "STOCK") {
    if (!factory) issues.push("Missing factory");
  }

  if (!row.dueDate && factory && factory !== "STOCK") {
    issues.push("Missing due date");
  }

  if (
    (factory === "KAZ" || factory === "VAR") &&
    !row.orderSentAt &&
    !norm(row.workshopNote)
  ) {
    issues.push("Missing workshop note");
  }

  return issues;
}

async function collectUnsentPanelsForDisplay(
  factoryGroup: "KAZ" | "VAR",
): Promise<AdminPanelRow[]> {
  const rpRows = await prisma.rpRequest.findMany({
    where: {
      reviewGroup: { contains: factoryGroup, mode: "insensitive" },
      orderSentAt: null,
    },
  });

  const ipRows = await prisma.rpInternalProductionRow.findMany({
    where: {
      factory: { contains: factoryGroup, mode: "insensitive" },
      orderSentAt: null,
    },
  });

  const suppressed = new Set<string>();
  for (const row of ipRows) {
    const source = norm(row.sourceRpNum).toUpperCase();
    if (source) suppressed.add(source);
  }

  const rows: AdminPanelRow[] = [];

  for (const row of rpRows) {
    if (!hasMeaningfulRpData(row)) continue;
    if (!isPanelRow(row.itemType)) continue;
    if (isTerminalStatus(row.status)) continue;
    const key = row.rpNum.replace(/\s+/g, "").toUpperCase();
    if (suppressed.has(key)) continue;
    rows.push({
      recordType: "rp",
      recordId: row.id,
      num: row.rpNum,
      factory: row.reviewGroup ?? "",
      description: row.partDescription ?? row.itemType ?? "",
      workshopNote: row.workshopNote,
      dueDate: formatDate(row.dueDate),
      urgency: row.urgency,
      status: row.status,
      issueType: row.issueType,
      boothId: row.boothId,
      model: row.model,
      color: row.color,
      market: row.market,
      clarifications: row.clarifications,
      notes: row.notes,
      payer: row.payer,
    });
  }

  for (const row of ipRows) {
    if (!isPanelRow(row.panel)) continue;
    if (isTerminalStatus(row.status)) continue;
    rows.push({
      recordType: "ip",
      recordId: row.id,
      num: row.ipNum,
      factory: row.factory ?? "",
      description: row.panel ?? "",
      workshopNote: row.workshopNote,
      dueDate: formatDate(row.deadline),
      urgency: row.urgency,
      status: row.status,
      issueType: row.reason,
      boothId: row.batch,
      model: row.model,
      color: row.colour,
      market: null,
      clarifications: row.panelClarification,
      notes: row.notes,
      payer: row.payer,
    });
  }

  return rows.sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));
}

function parseEntityNum(raw: string): number {
  const match = raw.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

/** Latest N panels for a factory (includes already-sent), for the “Select other panels” picker. */
export async function collectLatestFactoryPanels(
  factoryGroup: "KAZ" | "VAR",
  limit = 15,
): Promise<AdminPanelRow[]> {
  const rpRows = await prisma.rpRequest.findMany({
    where: {
      reviewGroup: { contains: factoryGroup, mode: "insensitive" },
    },
  });

  const ipRows = await prisma.rpInternalProductionRow.findMany({
    where: {
      factory: { contains: factoryGroup, mode: "insensitive" },
    },
  });

  const suppressed = new Set<string>();
  for (const row of ipRows) {
    const source = norm(row.sourceRpNum).toUpperCase();
    if (source) suppressed.add(source);
  }

  const rows: AdminPanelRow[] = [];

  for (const row of rpRows) {
    if (!hasMeaningfulRpData(row)) continue;
    if (!isPanelRow(row.itemType)) continue;
    if (norm(row.status).toLowerCase() === "cancelled") continue;
    const key = row.rpNum.replace(/\s+/g, "").toUpperCase();
    if (suppressed.has(key)) continue;
    rows.push({
      recordType: "rp",
      recordId: row.id,
      num: row.rpNum,
      factory: row.reviewGroup ?? "",
      description: row.partDescription ?? row.itemType ?? "",
      workshopNote: row.workshopNote,
      dueDate: formatDate(row.dueDate),
      urgency: row.urgency,
      status: row.status,
      issueType: row.issueType,
      boothId: row.boothId,
      model: row.model,
      color: row.color,
      market: row.market,
      clarifications: row.clarifications,
      notes: row.notes,
      payer: row.payer,
      orderSentAt: formatDate(row.orderSentAt),
    });
  }

  for (const row of ipRows) {
    if (!isPanelRow(row.panel)) continue;
    if (norm(row.status).toLowerCase() === "cancelled") continue;
    rows.push({
      recordType: "ip",
      recordId: row.id,
      num: row.ipNum,
      factory: row.factory ?? "",
      description: row.panel ?? "",
      workshopNote: row.workshopNote,
      dueDate: formatDate(row.deadline),
      urgency: row.urgency,
      status: row.status,
      issueType: row.reason,
      boothId: row.batch,
      model: row.model,
      color: row.colour,
      market: null,
      clarifications: row.panelClarification,
      notes: row.notes,
      payer: row.payer,
      orderSentAt: formatDate(row.orderSentAt),
    });
  }

  return rows
    .sort((a, b) => parseEntityNum(b.num) - parseEntityNum(a.num))
    .slice(0, limit);
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const rpRows = await prisma.rpRequest.findMany({
    orderBy: { rpNum: "asc" },
  });

  const issues: AdminIssueRow[] = [];
  for (const row of rpRows) {
    const rowIssues = detectRpIssues(row);
    if (!rowIssues.length) continue;
    issues.push({
      rpNum: row.rpNum,
      market: row.market,
      itemType: row.itemType,
      boothId: row.boothId,
      reviewGroup: row.reviewGroup,
      dueDate: formatDate(row.dueDate),
      status: row.status,
      urgency: row.urgency,
      issues: rowIssues,
    });
  }

  const delayed: AdminDelayedRow[] = [];

  for (const row of rpRows) {
    if (!hasMeaningfulRpData(row)) continue;
    if (isTerminalStatus(row.status)) continue;
    const overdueDays = getOverdueDays(row.dueDate);
    if (overdueDays == null) continue;
    delayed.push({
      rpNum: row.rpNum,
      recordType: "rp",
      dueDate: formatDate(row.dueDate),
      overdueDays,
      status: row.status,
      reviewGroup: row.reviewGroup,
      itemType: row.itemType,
      notes: row.notes,
    });
  }

  const ipRows = await prisma.rpInternalProductionRow.findMany();
  for (const row of ipRows) {
    if (isTerminalStatus(row.status)) continue;
    const overdueDays = getOverdueDays(row.deadline);
    if (overdueDays == null) continue;
    delayed.push({
      rpNum: row.ipNum,
      recordType: "ip",
      dueDate: formatDate(row.deadline),
      overdueDays,
      status: row.status,
      reviewGroup: row.factory,
      itemType: row.panel,
      notes: row.notes,
    });
  }

  delayed.sort((a, b) => {
    if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
    return a.rpNum.localeCompare(b.rpNum, undefined, { numeric: true });
  });

  const [unsentKaz, unsentVar, recentKaz, recentVar] = await Promise.all([
    collectUnsentPanelsForDisplay("KAZ"),
    collectUnsentPanelsForDisplay("VAR"),
    collectLatestFactoryPanels("KAZ", 15),
    collectLatestFactoryPanels("VAR", 15),
  ]);

  return { issues, delayed, unsentKaz, unsentVar, recentKaz, recentVar };
}

/** Panels eligible for PDF export (workshop note required — same as Slack automation). */
export async function collectExportablePanels(
  factoryGroup: "KAZ" | "VAR",
): Promise<AdminPanelRow[]> {
  const entries = await collectFactoryPanelsForOrder(factoryGroup, "all");
  return entries.map(panelEntryToRow);
}

export function adminPanelToExportRow(row: AdminPanelRow) {
  return {
    num: row.num,
    issue: row.issueType ?? "",
    payer: row.payer ?? "",
    boothId: row.boothId ?? "",
    model: row.model ?? "",
    colour: row.color ?? "",
    clarifications: row.clarifications ?? "",
    description: row.description,
    workshopNote: row.workshopNote ?? "",
    due: row.dueDate ?? "",
    market: row.market ?? "",
  };
}

export async function loadPanelExportRowsByNums(
  rpNums: string[],
  ipNums: string[],
): Promise<AdminPanelRow[]> {
  const rows: AdminPanelRow[] = [];

  if (rpNums.length) {
    const rpRows = await prisma.rpRequest.findMany({
      where: { rpNum: { in: rpNums } },
    });
    for (const row of rpRows) {
      if (!hasMeaningfulRpData(row)) continue;
      rows.push({
        recordType: "rp",
        recordId: row.id,
        num: row.rpNum,
        factory: row.reviewGroup ?? "",
        description: row.partDescription ?? row.itemType ?? "",
        workshopNote: row.workshopNote,
        dueDate: formatDate(row.dueDate),
        urgency: row.urgency,
        status: row.status,
        issueType: row.issueType,
        boothId: row.boothId,
        model: row.model,
        color: row.color,
        market: row.market,
        clarifications: row.clarifications,
        notes: row.notes,
        payer: row.payer,
      });
    }
  }

  if (ipNums.length) {
    const ipRows = await prisma.rpInternalProductionRow.findMany({
      where: { ipNum: { in: ipNums } },
    });
    for (const row of ipRows) {
      rows.push({
        recordType: "ip",
        recordId: row.id,
        num: row.ipNum,
        factory: row.factory ?? "",
        description: row.panel ?? "",
        workshopNote: row.workshopNote,
        dueDate: formatDate(row.deadline),
        urgency: row.urgency,
        status: row.status,
        issueType: row.reason,
        boothId: row.batch,
        model: row.model,
        color: row.colour,
        market: null,
        clarifications: row.panelClarification,
        notes: row.notes,
        payer: row.payer,
      });
    }
  }

  return rows.sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));
}
