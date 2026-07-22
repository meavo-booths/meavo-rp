import type { Prisma } from "@prisma/client";

import type { DbExecutor } from "@/lib/db/executor";
import { prisma } from "@/lib/prisma";

export type LifecycleEntityType = "rp" | "ip";

export type LifecycleEventType =
  | "created"
  | "status_changed"
  | "ready_marked"
  | "ready_reverted"
  | "order_sent"
  | "shipped"
  | "cancelled"
  | "delayed"
  | "stock_taken"
  | "edited"
  | "workshop_note"
  | "due_date_changed"
  | "ship_info_changed"
  | "delivered"
  | "payer_changed";

export type RecordLifecycleEventInput = {
  entityType: LifecycleEntityType;
  entityId: string;
  eventType: LifecycleEventType | string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorEmail?: string | null;
  payload?: Prisma.InputJsonValue;
  createdAt?: Date;
};

const EVENT_LABELS_FALLBACK: Record<string, string> = {
  created: "Logged",
  status_changed: "Status changed",
  ready_marked: "Marked Ready",
  ready_reverted: "Reverted from Ready",
  order_sent: "Order sent to factory",
  shipped: "Shipped",
  cancelled: "Cancelled",
  delayed: "Delayed",
  stock_taken: "Taken from stock",
  edited: "Edited",
  workshop_note: "Workshop note",
  due_date_changed: "Due date changed",
  ship_info_changed: "Shipping info updated",
  delivered: "Delivered",
  payer_changed: "Payer changed",
  photo: "Photo uploaded",
};

export function lifecycleEventLabel(eventType: string): string {
  return EVENT_LABELS_FALLBACK[eventType] ?? eventType;
}

export async function recordLifecycleEvent(
  input: RecordLifecycleEventInput,
  executor: DbExecutor = prisma,
): Promise<void> {
  await executor.rpLifecycleEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      fromStatus: input.fromStatus?.trim() || null,
      toStatus: input.toStatus?.trim() || null,
      actorEmail: input.actorEmail?.trim().toLowerCase() || null,
      payload: input.payload ?? undefined,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

export type TimelineEntry = {
  id: string;
  at: string;
  eventType: string;
  label: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorEmail: string | null;
  source: "event" | "inferred";
  detail: string | null;
};

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function inferredId(eventType: string, at: string): string {
  return `inferred:${eventType}:${at}`;
}

type InferSource = {
  entryDate?: Date | null;
  createdAt?: Date | null;
  orderSentAt?: Date | null;
  readyMarkedAt?: Date | null;
  notes?: string | null;
  stockEvents?: { at: Date; by: string | null; detail?: string | null }[];
  photoEvents?: { at: Date; detail?: string | null }[];
};

function parseDelayStamps(notes: string | null | undefined): TimelineEntry[] {
  if (!notes) return [];
  const entries: TimelineEntry[] = [];
  const re = /\[(\d{2})\/(\d{2})\s+Delayed:\s*([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  const year = new Date().getFullYear();
  while ((match = re.exec(notes)) !== null) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const reason = match[3].trim();
    const atDate = new Date(year, month - 1, day, 12, 0, 0);
    const at = atDate.toISOString();
    entries.push({
      id: inferredId("delayed", `${at}:${reason}`),
      at,
      eventType: "delayed",
      label: lifecycleEventLabel("delayed"),
      fromStatus: null,
      toStatus: "Delayed",
      actorEmail: null,
      source: "inferred",
      detail: reason || null,
    });
  }
  return entries;
}

export function inferBestEffortTimeline(source: InferSource): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const loggedAt = iso(source.entryDate) ?? iso(source.createdAt);
  if (loggedAt) {
    out.push({
      id: inferredId("created", loggedAt),
      at: loggedAt,
      eventType: "created",
      label: lifecycleEventLabel("created"),
      fromStatus: null,
      toStatus: null,
      actorEmail: null,
      source: "inferred",
      detail: null,
    });
  }
  const orderSent = iso(source.orderSentAt);
  if (orderSent) {
    out.push({
      id: inferredId("order_sent", orderSent),
      at: orderSent,
      eventType: "order_sent",
      label: lifecycleEventLabel("order_sent"),
      fromStatus: null,
      toStatus: null,
      actorEmail: null,
      source: "inferred",
      detail: null,
    });
  }
  const readyAt = iso(source.readyMarkedAt);
  if (readyAt) {
    out.push({
      id: inferredId("ready_marked", readyAt),
      at: readyAt,
      eventType: "ready_marked",
      label: lifecycleEventLabel("ready_marked"),
      fromStatus: null,
      toStatus: "Ready",
      actorEmail: null,
      source: "inferred",
      detail: null,
    });
  }
  for (const stock of source.stockEvents ?? []) {
    const at = iso(stock.at);
    if (!at) continue;
    out.push({
      id: inferredId("stock_taken", `${at}:${stock.detail ?? ""}`),
      at,
      eventType: "stock_taken",
      label: lifecycleEventLabel("stock_taken"),
      fromStatus: null,
      toStatus: null,
      actorEmail: stock.by,
      source: "inferred",
      detail: stock.detail ?? null,
    });
  }
  for (const photo of source.photoEvents ?? []) {
    const at = iso(photo.at);
    if (!at) continue;
    out.push({
      id: inferredId("photo", `${at}:${photo.detail ?? ""}`),
      at,
      eventType: "photo",
      label: lifecycleEventLabel("photo"),
      fromStatus: null,
      toStatus: null,
      actorEmail: null,
      source: "inferred",
      detail: photo.detail ?? null,
    });
  }
  out.push(...parseDelayStamps(source.notes));
  return out;
}

export function mergeTimeline(
  events: {
    id: string;
    createdAt: Date;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    actorEmail: string | null;
    payload: Prisma.JsonValue | null;
  }[],
  inferred: TimelineEntry[],
): TimelineEntry[] {
  const fromEvents: TimelineEntry[] = events.map((e) => {
    const payload =
      e.payload && typeof e.payload === "object" && !Array.isArray(e.payload)
        ? (e.payload as Record<string, unknown>)
        : null;
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : typeof payload?.reason === "string"
          ? payload.reason
          : typeof payload?.tracking === "string"
            ? payload.tracking
            : null;
    return {
      id: e.id,
      at: e.createdAt.toISOString(),
      eventType: e.eventType,
      label: lifecycleEventLabel(e.eventType),
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorEmail: e.actorEmail,
      source: "event" as const,
      detail,
    };
  });

  const coveredTypes = new Set(fromEvents.map((e) => e.eventType));
  const coveredReady = fromEvents.some(
    (e) => e.eventType === "ready_marked" || e.toStatus === "Ready",
  );
  const coveredOrder = coveredTypes.has("order_sent");
  const coveredCreated = coveredTypes.has("created");
  const coveredStock = coveredTypes.has("stock_taken");
  const coveredDelayed = coveredTypes.has("delayed");

  const extras = inferred.filter((entry) => {
    if (entry.eventType === "created") return !coveredCreated;
    if (entry.eventType === "order_sent") return !coveredOrder;
    if (entry.eventType === "ready_marked") return !coveredReady;
    if (entry.eventType === "stock_taken") return !coveredStock;
    if (entry.eventType === "delayed") return !coveredDelayed;
    if (entry.eventType === "photo") return true;
    return !coveredTypes.has(entry.eventType);
  });

  return [...fromEvents, ...extras].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

export async function loadEntityTimeline(
  entityType: LifecycleEntityType,
  entityId: string,
  inferredSource: InferSource,
): Promise<TimelineEntry[]> {
  const events = await prisma.rpLifecycleEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "asc" },
  });
  return mergeTimeline(events, inferBestEffortTimeline(inferredSource));
}
