import type { Prisma, RpRequest, RpUrgency } from "@prisma/client";

import type { DbExecutor } from "@/lib/db/executor";
import { enqueueSheetSync } from "@/lib/domain/panel-orders";
import { recalculateFactoryFillForRpId } from "@/lib/domain/factory-fill";
import { recordLifecycleEvent } from "@/lib/domain/lifecycle-events";
import { notifyAfterRpMutation } from "@/lib/integrations/slack/rp-slack-bot";
import { mintNextRpNum } from "@/lib/domain/rp-numbers";
import {
  assertRpReasonWhenRequired,
  type LoggerFormInput,
  formatClarificationsColumn,
  formatDescriptionColumn,
  formatItemTypeForSheet,
  formatPartCodeColumn,
  formatQuantityColumn,
  mapBoothModelToAbbreviation,
  normalizeLoggerItems,
  shouldSplitItemsIntoSeparateRps,
} from "@/lib/domain/rp-form-mapper";
import { upsertRpLineItemsFromRow } from "@/lib/domain/rp-line-item-sync";
import { computeRpPayerForDb } from "@/lib/domain/rp-payer";
import { computeAutoDueDate } from "@/lib/domain/working-days";
import { prisma } from "@/lib/prisma";

function toUrgency(value: string): RpUrgency {
  return value.toLowerCase() === "urgent" ? "urgent" : "standard";
}

function buildRpRowData(
  form: LoggerFormInput,
  items: LoggerFormInput["items"],
  userEmail: string,
  rpNum: string,
  isNew: boolean,
): Prisma.RpRequestCreateInput {
  const entryDate = isNew ? new Date() : undefined;
  const itemType = formatItemTypeForSheet(items, form.model);
  const dueDate =
    isNew && entryDate
      ? computeAutoDueDate(itemType, form.urgency, entryDate)
      : undefined;

  return {
    rpNum,
    entryDate,
    market: form.market.trim(),
    userId: userEmail,
    issueType: form.issueType.trim(),
    urgency: toUrgency(form.urgency),
    model: mapBoothModelToAbbreviation(form.model),
    boothId: form.boothId.trim(),
    color: form.color.trim(),
    itemType,
    quantity: formatQuantityColumn(items),
    partRpCode: formatPartCodeColumn(items),
    partDescription: formatDescriptionColumn(items),
    clarifications: formatClarificationsColumn(items),
    notes: form.notes.trim(),
    client: form.client.trim(),
    address: form.address.trim(),
    recipient: form.recipient.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    status: "",
    dueDate: dueDate ?? undefined,
    payer: computeRpPayerForDb({
      issueType: form.issueType.trim(),
      reviewGroup: null,
      itemType,
      quantity: formatQuantityColumn(items),
      partRpCode: formatPartCodeColumn(items),
      partDescription: formatDescriptionColumn(items),
      clarifications: formatClarificationsColumn(items),
      lineItems: items.map((item) => ({
        kind: item.itemType === "Panel" ? "panel" : "part",
      })),
    }),
    payerManual: false,
    itemsJson: items as unknown as Prisma.InputJsonValue,
  };
}

async function createSingleRp(
  executor: DbExecutor,
  form: LoggerFormInput,
  items: LoggerFormInput["items"],
  userEmail: string,
): Promise<string> {
  const rpNum = await mintNextRpNum(executor);
  const data = buildRpRowData(form, items, userEmail, rpNum, true);
  const created = await executor.rpRequest.create({ data });
  await upsertRpLineItemsFromRow(created.id, created as RpRequest, executor);
  await recordLifecycleEvent(
    {
      entityType: "rp",
      entityId: created.id,
      eventType: "created",
      toStatus: created.status,
      actorEmail: userEmail,
      payload: { rpNum },
    },
    executor,
  );
  await enqueueSheetSync("rp", created.id, "upsert", executor);
  await recalculateFactoryFillForRpId(created.id);
  void notifyAfterRpMutation(rpNum, "created");
  return rpNum;
}

export async function processNewRpEntry(
  form: LoggerFormInput,
  userEmail: string,
  executor: DbExecutor = prisma,
): Promise<{ rpNums: string[] }> {
  const items = normalizeLoggerItems(form.items);
  if (!items.length) throw new Error("At least one item is required.");
  assertRpReasonWhenRequired(form.issueType, form.notes);

  if (shouldSplitItemsIntoSeparateRps(items)) {
    const rpNums: string[] = [];
    for (const item of items) {
      const rpNum = await createSingleRp(executor, form, [item], userEmail);
      rpNums.push(rpNum);
    }
    return { rpNums };
  }

  const rpNum = await createSingleRp(executor, form, items, userEmail);
  return { rpNums: [rpNum] };
}

export async function cancelRpRequest(
  rpNum: string,
  userEmail: string,
  executor: DbExecutor = prisma,
): Promise<void> {
  const row = await executor.rpRequest.findUnique({ where: { rpNum } });
  if (!row) throw new Error("RP not found.");
  if ((row.userId ?? "").toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("You can cancel only your own RPs.");
  }
  const status = (row.status ?? "").trim();
  if (status === "Shipped" || status === "Cancelled") {
    throw new Error("This RP cannot be cancelled.");
  }
  await executor.rpRequest.update({
    where: { id: row.id },
    data: { status: "Cancelled", updatedAt: new Date() },
  });
  await recordLifecycleEvent(
    {
      entityType: "rp",
      entityId: row.id,
      eventType: "cancelled",
      fromStatus: status,
      toStatus: "Cancelled",
      actorEmail: userEmail,
    },
    executor,
  );
  await enqueueSheetSync("rp", row.id, "upsert", executor);
  // GAS cancelRp: tell logistics when an RP leaves Ready via cancellation.
  if (status === "Ready") {
    void notifyAfterRpMutation(row.rpNum, "left_ready");
  }
}
