import type { RpRequest } from "@prisma/client";

import {
  getEffectiveUserEmail,
  getRegionalScopes,
  getReviewerDashboardConfig,
  isAdminUser,
  normalizeEmail,
  type ReviewerDashboardConfig,
} from "@/lib/domain/authz";
import { getRpEditWindowInfo } from "@/lib/domain/rp-edit-window";
import { parseRpLineItemsFromRow } from "@/lib/domain/rp-line-items";
import { prisma } from "@/lib/prisma";
import type { ViewerContext } from "@/lib/viewer-context";

export type PartsViewType =
  | "active"
  | "archive"
  | "cancelled"
  | "ready"
  | "all";

export type DashboardPartCard = {
  id: string;
  /** "rp" (default) or "ip" for merged Internal Production rows. */
  recordType: "rp" | "ip";
  rpNum: string;
  dueDate: string | null;
  market: string | null;
  userId: string | null;
  issueType: string | null;
  urgency: string;
  model: string | null;
  boothId: string | null;
  color: string | null;
  itemType: string | null;
  quantity: string | null;
  partRpCode: string | null;
  partDescription: string | null;
  clarifications: string | null;
  notes: string | null;
  client: string | null;
  address: string | null;
  recipient: string | null;
  phone: string | null;
  email: string | null;
  shipMethod: string | null;
  status: string | null;
  tracking: string | null;
  reviewGroup: string | null;
  workshopNote: string | null;
  canEditRp: boolean;
  editRpDisabledReason: string;
  items: ReturnType<typeof parseRpLineItemsFromRow>;
};

function isOrderedOnAmazonStatus(status: string): boolean {
  return status.trim().toLowerCase() === "ordered on amazon";
}

import { matchesRegionalScope } from "@/lib/domain/regional-markets";

function isReviewerDashboardEligibleRow(
  itemType: string | null,
  reviewGroup: string | null,
  config: ReviewerDashboardConfig,
): boolean {
  const group = (reviewGroup ?? "").trim().toUpperCase();
  const allowedGroups = config.allowedReviewGroups.map((g) => g.toUpperCase());
  const groupOk = allowedGroups.some((token) => group.includes(token));
  if (!groupOk) return false;

  const type = (itemType ?? "").trim().toUpperCase();
  if (config.allowAllItemTypes) {
    const excluded = (config.excludedItemTypes ?? []).map((t) => t.toUpperCase());
    if (excluded.some((ex) => type.includes(ex))) return false;
    return true;
  }
  const allowed = (config.allowedItemTypes ?? []).map((t) => t.toUpperCase());
  return allowed.some((token) => type.includes(token));
}

function matchesViewType(
  viewType: PartsViewType,
  status: string,
  filterAsReviewer: boolean,
): boolean {
  if (viewType === "all") return true;
  if (viewType === "archive") {
    return status === "Shipped" || isOrderedOnAmazonStatus(status);
  }
  if (viewType === "cancelled") return status === "Cancelled";
  if (viewType === "ready") return filterAsReviewer && status === "Ready";
  if (filterAsReviewer) {
    return (
      status !== "Shipped" &&
      status !== "Cancelled" &&
      status !== "Ready" &&
      !isOrderedOnAmazonStatus(status)
    );
  }
  return (
    status !== "Shipped" &&
    status !== "Cancelled" &&
    !isOrderedOnAmazonStatus(status)
  );
}

function toCard(row: RpRequest, viewerEmail: string): DashboardPartCard {
  const edit = getRpEditWindowInfo({
    entryDate: row.entryDate,
    rowOwnerEmail: row.userId,
    viewerEmail,
    status: row.status,
  });
  return {
    id: row.id,
    recordType: "rp",
    rpNum: row.rpNum,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    market: row.market,
    userId: row.userId,
    issueType: row.issueType,
    urgency: row.urgency,
    model: row.model,
    boothId: row.boothId,
    color: row.color,
    itemType: row.itemType,
    quantity: row.quantity,
    partRpCode: row.partRpCode,
    partDescription: row.partDescription,
    clarifications: row.clarifications,
    notes: row.notes,
    client: row.client,
    address: row.address,
    recipient: row.recipient,
    phone: row.phone,
    email: row.email,
    shipMethod: row.shipMethod,
    status: row.status,
    tracking: row.tracking,
    reviewGroup: row.reviewGroup,
    workshopNote: row.workshopNote,
    canEditRp: edit.canEdit,
    editRpDisabledReason: edit.reason,
    items: parseRpLineItemsFromRow(row),
  };
}

function sortCards(
  cards: DashboardPartCard[],
  viewType: PartsViewType,
  filterAsReviewer: boolean,
): DashboardPartCard[] {
  return [...cards].sort((a, b) => {
    const aUrgent = a.urgency === "urgent";
    const bUrgent = b.urgency === "urgent";
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    if (filterAsReviewer) {
      const dueCmp = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      if (dueCmp !== 0) return dueCmp;
    }
    const aNum = Number(a.rpNum.replace(/\D/g, "")) || 0;
    const bNum = Number(b.rpNum.replace(/\D/g, "")) || 0;
    return viewType === "active" ? bNum - aNum : bNum - aNum;
  });
}

export async function getDashboardParts(options: {
  viewer: ViewerContext;
  viewType?: PartsViewType;
  regionalScope?: string;
  search?: string;
}): Promise<DashboardPartCard[]> {
  const viewType = options.viewType ?? "active";
  const viewer = options.viewer;
  const reviewerConfig = viewer.reviewerConfig;
  const filterAsReviewer = Boolean(reviewerConfig);
  const ownerEmail = filterAsReviewer
    ? null
    : normalizeEmail(viewer.effectiveEmail);

  const rows = await prisma.rpRequest.findMany({
    orderBy: { rpNum: "desc" },
  });

  const scopes = options.regionalScope
    ? options.regionalScope.split("|").filter(Boolean)
    : getRegionalScopes(viewer.effectiveEmail);

  const search = (options.search ?? "").trim().toLowerCase();

  const filtered = rows.filter((row) => {
    const status = (row.status ?? "").trim();
    if (!matchesViewType(viewType, status, filterAsReviewer)) return false;

    if (filterAsReviewer && reviewerConfig) {
      if (
        !isReviewerDashboardEligibleRow(
          row.itemType,
          row.reviewGroup,
          reviewerConfig,
        )
      ) {
        return false;
      }
    } else if (ownerEmail) {
      const rowOwner = normalizeEmail(row.userId);
      if (rowOwner !== ownerEmail) {
        if (!scopes.length) return false;
        const marketOk = scopes.some((scope) =>
          matchesRegionalScope(scope, row.market),
        );
        if (!marketOk) return false;
      }
    }

    if (search) {
      const haystack = [
        row.rpNum,
        row.client,
        row.market,
        row.itemType,
        row.partDescription,
        row.userId,
        row.boothId,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  const viewerForEdit = getEffectiveUserEmail(
    viewer.sessionEmail,
    viewer.isSimulating ? viewer.effectiveEmail : null,
    viewer.isAdmin,
  );

  return sortCards(
    filtered.map((row) => toCard(row, viewerForEdit)),
    viewType,
    filterAsReviewer,
  );
}

export function canUseStandardPartsDashboard(viewer: ViewerContext): boolean {
  if (viewer.reviewerConfig) return true;
  if (viewer.role !== "standard" && viewer.role !== "admin") return false;
  return true;
}

export function isAdminOwnPartsMode(
  viewer: ViewerContext,
  adminOwnLoggedParts: boolean,
): boolean {
  return adminOwnLoggedParts && isAdminUser(viewer.sessionEmail);
}

const ALL_OWNER_FACTORIES = ["AKS", "VAR", "KAZ"];

function matchesAllOwnersFactory(reviewGroup: string | null): boolean {
  const g = (reviewGroup ?? "").trim().toUpperCase();
  return ALL_OWNER_FACTORIES.some((f) => g.includes(f));
}

/** Port of getPartsDataAllOwners_ — AKS/VAR/KAZ, no owner filter. */
export async function getDashboardPartsAllOwners(options: {
  viewer: ViewerContext;
  viewType?: PartsViewType;
  factoryFilter?: string;
  search?: string;
}): Promise<DashboardPartCard[]> {
  const viewType = options.viewType ?? "active";
  const rows = await prisma.rpRequest.findMany({ orderBy: { rpNum: "desc" } });
  const search = (options.search ?? "").trim().toLowerCase();
  const factoryFilter = options.factoryFilter?.toUpperCase();

  const filtered = rows.filter((row) => {
    if (!matchesAllOwnersFactory(row.reviewGroup)) return false;
    if (factoryFilter && !(row.reviewGroup ?? "").toUpperCase().includes(factoryFilter)) {
      return false;
    }
    const status = (row.status ?? "").trim();
    if (!matchesViewType(viewType, status, false)) return false;
    if (search) {
      const haystack = [row.rpNum, row.client, row.market, row.itemType, row.userId]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const viewerForEdit = getEffectiveUserEmail(
    options.viewer.sessionEmail,
    options.viewer.isSimulating ? options.viewer.effectiveEmail : null,
    options.viewer.isAdmin,
  );

  return sortCards(
    filtered.map((row) => toCard(row, viewerForEdit)),
    viewType,
    false,
  );
}

/** Ivan dashboard — all factories, read-only all-owners loader. */
export async function getIvanDashboardParts(
  viewer: ViewerContext,
  viewType: PartsViewType = "active",
): Promise<DashboardPartCard[]> {
  return getDashboardPartsAllOwners({ viewer, viewType });
}
