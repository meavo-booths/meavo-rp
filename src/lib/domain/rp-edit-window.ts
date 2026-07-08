const RP_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;
const RP_EDIT_WINDOW_EXPIRED_MSG =
  "The 2-hour edit window for this RP has expired.";

function isOrderedOnAmazonStatus(status: string): boolean {
  return status.trim().toLowerCase() === "ordered on amazon";
}

export type RpEditWindowInfo = {
  canEdit: boolean;
  reason: string;
};

export function getRpEditWindowInfo(options: {
  entryDate: Date | null | undefined;
  rowOwnerEmail: string | null | undefined;
  viewerEmail: string;
  status: string | null | undefined;
}): RpEditWindowInfo {
  const ownerNorm = (options.rowOwnerEmail ?? "").trim().toLowerCase();
  const viewerNorm = options.viewerEmail.trim().toLowerCase();
  if (!ownerNorm || ownerNorm !== viewerNorm) {
    return { canEdit: false, reason: "" };
  }

  const statusNorm = (options.status ?? "").trim();
  if (
    statusNorm === "Shipped" ||
    statusNorm === "Cancelled" ||
    isOrderedOnAmazonStatus(statusNorm)
  ) {
    return { canEdit: false, reason: RP_EDIT_WINDOW_EXPIRED_MSG };
  }

  const entryDate = options.entryDate ? new Date(options.entryDate) : null;
  if (!entryDate || Number.isNaN(entryDate.getTime())) {
    return { canEdit: false, reason: RP_EDIT_WINDOW_EXPIRED_MSG };
  }

  const elapsedMs = Date.now() - entryDate.getTime();
  if (elapsedMs <= RP_EDIT_WINDOW_MS) {
    return { canEdit: true, reason: "" };
  }
  return { canEdit: false, reason: RP_EDIT_WINDOW_EXPIRED_MSG };
}
