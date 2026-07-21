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
};

export type AdminDashboardData = {
  issues: AdminIssueRow[];
  delayed: AdminDelayedRow[];
  unsentKaz: AdminPanelRow[];
  unsentVar: AdminPanelRow[];
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
  };
}

function detectRpIssues(row: RpRequest): string[] {
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
    });
  }

  return rows.sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));
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
    if (norm(row.status).toLowerCase() !== "delayed") continue;
    delayed.push({
      rpNum: row.rpNum,
      recordType: "rp",
      dueDate: formatDate(row.dueDate),
      status: row.status,
      reviewGroup: row.reviewGroup,
      itemType: row.itemType,
      notes: row.notes,
    });
  }

  const ipRows = await prisma.rpInternalProductionRow.findMany({
    where: { status: { equals: "Delayed", mode: "insensitive" } },
  });
  for (const row of ipRows) {
    delayed.push({
      rpNum: row.ipNum,
      recordType: "ip",
      dueDate: formatDate(row.deadline),
      status: row.status,
      reviewGroup: row.factory,
      itemType: row.panel,
      notes: row.notes,
    });
  }

  delayed.sort((a, b) => a.rpNum.localeCompare(b.rpNum, undefined, { numeric: true }));

  const [unsentKaz, unsentVar] = await Promise.all([
    collectUnsentPanelsForDisplay("KAZ"),
    collectUnsentPanelsForDisplay("VAR"),
  ]);

  return { issues, delayed, unsentKaz, unsentVar };
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
    payer: row.factory,
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
      });
    }
  }

  return rows.sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }));
}
