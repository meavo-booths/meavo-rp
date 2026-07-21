import type { LoggerFormInput } from "@/lib/domain/rp-form-mapper";
import {
  assertRpReasonWhenRequired,
  formatClarificationsColumn,
  formatDescriptionColumn,
  formatItemTypeForSheet,
  formatPartCodeColumn,
  formatQuantityColumn,
  mapAbbreviationToBoothModel,
  mapBoothModelToAbbreviation,
  normalizeLoggerItems,
} from "@/lib/domain/rp-form-mapper";
import { getRpEditWindowInfo } from "@/lib/domain/rp-edit-window";
import { upsertRpLineItemsFromRow } from "@/lib/domain/rp-line-item-sync";
import { normalizeRpNum } from "@/lib/domain/rp-numbers";
import { recalculateFactoryFillForRpId } from "@/lib/domain/factory-fill";
import { recordLifecycleEvent } from "@/lib/domain/lifecycle-events";
import { enqueueSheetSync } from "@/lib/domain/panel-orders";
import { computeRpPayerForDb } from "@/lib/domain/rp-payer";
import { prisma } from "@/lib/prisma";

function rowToLoggerForm(row: {
  rpNum: string;
  market: string | null;
  urgency: string;
  model: string | null;
  boothId: string | null;
  color: string | null;
  issueType: string | null;
  notes: string | null;
  client: string | null;
  address: string | null;
  recipient: string | null;
  phone: string | null;
  email: string | null;
  itemType: string | null;
  quantity: string | null;
  partRpCode: string | null;
  partDescription: string | null;
  clarifications: string | null;
  itemsJson: unknown;
}): LoggerFormInput & { rpNum: string } {
  return {
    rpNum: row.rpNum,
    market: row.market ?? "",
    urgency: row.urgency === "urgent" ? "urgent" : "standard",
    model: mapAbbreviationToBoothModel(row.model ?? ""),
    boothId: row.boothId ?? "",
    color: row.color ?? "",
    issueType: row.issueType ?? "",
    notes: row.notes ?? "",
    client: row.client ?? "",
    address: row.address ?? "",
    recipient: row.recipient ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    items: normalizeLoggerItems(
      (row.itemsJson as LoggerFormInput["items"] | null) ?? [
        {
          itemType: (row.itemType ?? "Part") as "Part" | "Panel",
          qty: row.quantity ?? "1",
          description: row.partDescription ?? "",
          rpCode: row.partRpCode ?? "",
          itemNotes: row.clarifications ?? "",
        },
      ],
    ),
  };
}

export async function getEditableRpData(rpNum: string, viewerEmail: string) {
  const normalized = normalizeRpNum(rpNum);
  const row = await prisma.rpRequest.findUnique({ where: { rpNum: normalized } });
  if (!row) throw new Error("RP not found");

  const edit = getRpEditWindowInfo({
    entryDate: row.entryDate,
    rowOwnerEmail: row.userId,
    viewerEmail,
    status: row.status,
  });
  if (!edit.canEdit) throw new Error(edit.reason);

  return rowToLoggerForm(row);
}

export async function getSimilarRpData(rpNum: string): Promise<LoggerFormInput> {
  const normalized = normalizeRpNum(rpNum);
  const row = await prisma.rpRequest.findUnique({ where: { rpNum: normalized } });
  if (!row) throw new Error("RP not found");
  const form = rowToLoggerForm(row);
  const { rpNum: _omit, ...rest } = form;
  return rest;
}

export async function updateExistingRpEntry(
  form: LoggerFormInput & { rpNum: string },
  userEmail: string,
): Promise<void> {
  const normalized = normalizeRpNum(form.rpNum);
  const existing = await prisma.rpRequest.findUnique({
    where: { rpNum: normalized },
  });
  if (!existing) throw new Error("RP not found");

  const edit = getRpEditWindowInfo({
    entryDate: existing.entryDate,
    rowOwnerEmail: existing.userId,
    viewerEmail: userEmail,
    status: existing.status,
  });
  if (!edit.canEdit) throw new Error(edit.reason);

  const items = normalizeLoggerItems(form.items);
  assertRpReasonWhenRequired(form.issueType, form.notes);

  const itemType = formatItemTypeForSheet(items, form.model);
  const quantity = formatQuantityColumn(items);
  const partRpCode = formatPartCodeColumn(items);
  const partDescription = formatDescriptionColumn(items);
  const clarifications = formatClarificationsColumn(items);
  const payerData = existing.payerManual
    ? {}
    : {
        payer: computeRpPayerForDb({
          issueType: form.issueType.trim(),
          reviewGroup: existing.reviewGroup,
          itemType,
          quantity,
          partRpCode,
          partDescription,
          clarifications,
          lineItems: items.map((item) => ({
            kind: item.itemType === "Panel" ? "panel" : "part",
          })),
        }),
      };

  const updated = await prisma.rpRequest.update({
    where: { id: existing.id },
    data: {
      market: form.market.trim(),
      issueType: form.issueType.trim(),
      urgency: form.urgency.toLowerCase() === "urgent" ? "urgent" : "standard",
      model: mapBoothModelToAbbreviation(form.model),
      boothId: form.boothId.trim(),
      color: form.color.trim(),
      itemType,
      quantity,
      partRpCode,
      partDescription,
      clarifications,
      notes: form.notes.trim(),
      client: form.client.trim(),
      address: form.address.trim(),
      recipient: form.recipient.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      itemsJson: items,
      ...payerData,
      updatedAt: new Date(),
    },
  });

  await upsertRpLineItemsFromRow(updated.id, updated, prisma);
  await recordLifecycleEvent({
    entityType: "rp",
    entityId: updated.id,
    eventType: "edited",
    actorEmail: userEmail,
  });
  await enqueueSheetSync("rp", updated.id);
  await recalculateFactoryFillForRpId(updated.id);
}
