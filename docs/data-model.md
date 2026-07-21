# Data model — RP tables in meavo-rp

Prisma schema is canonical in **[meavo-db](https://github.com/meavo-booths/meavo-db)** (`prisma/schema.prisma`). This app consumes it via `@meavo/db` and runs `prisma generate` only — **do not edit schema here**.

Local reference: `node_modules/@meavo/db/prisma/schema.prisma` (search for `model Rp`).

Current pinned version: see `package.json` → `"@meavo/db": "git+...#vX.Y.Z"`.

## Entity relationship (simplified)

```
RpRequest (1) ──< RpLineItem
     │
     ├──< RpPhoto
     ├──< RpLifecycleEvent (polymorphic entityId)
     └──< RpInternalProductionRow (sourceRp)

RpLineItem ── optional ──> RpInternalProductionRow (stock replacement / source)

RpSheetSyncOutbox ──> async backup to Google Sheets
RpSheetRowMap     ──> entity → sheet row number
```

## Core tables

### `RpRequest` → `rp_requests`

One RP header. Maps 1:1 to a Rep.Parts26 row (columns via `sheet-row-mapper.ts`).

| Field | Notes |
|-------|--------|
| `rpNum` | Unique human id (e.g. `RP-12345`) |
| `userId` | Owner email |
| `market`, `issueType`, `urgency`, `model`, `boothId`, `color` | Logger fields |
| `itemType`, `quantity`, `partRpCode`, `partDescription`, `clarifications` | Aggregated line display (legacy sheet shape) |
| `client`, `address`, `recipient`, `phone`, `email` | Shipping |
| `reviewGroup` | Factory routing (AKS/KAZ/VAR…) |
| `shipMethod`, `status`, `tracking` | Logistics |
| `readyMarkedAt` | When marked Ready |
| `workshopNote` | Factory note (sheet AD) |
| `orderSentAt` | Panel order sent (sheet AE) — null = not sent |
| `dueDate` | Production/shipping deadline |
| `itemsJson` | Legacy JSON blob; prefer `RpLineItem` relation |
| `stockReplacementSummary` | `none` \| `partial` \| `full` |
| `syncedAt` | Last successful sheet backup |

Enums: `urgency` → `RpUrgency` (`standard` \| `urgent`).

### `RpLifecycleEvent` → `rp_lifecycle_events`

Append-only history for RP/IP detail timelines (`@meavo/db` ≥ v0.25.0). Polymorphic via `entityType` (`rp`\|`ip`) + `entityId`. Written by domain mutations; older rows may also show inferred milestones from `entryDate` / `orderSentAt` / `readyMarkedAt` / stock timestamps.

### `RpLineItem` → `rp_line_items`

Individual panels/parts on a multi-line RP.

| Field | Notes |
|-------|--------|
| `lineIndex` | Order within RP |
| `kind` | `RpLineItemKind` |
| `panelName`, `quantity`, `partRpCode`, `partDescription`, `clarifications` | Line detail |
| `fulfillment` | `pending` \| `from_stock` \| … (`RpLineItemFulfillment`) |
| `stockReplacementIpId` | Link to IP used for stock replacement |
| `sourceLineItemId` | Reverse link from IP created from line |

### `RpInternalProductionRow` → `internal_production_rows`

Internal Production sheet tab.

| Field | Notes |
|-------|--------|
| `ipNum` | Unique id |
| `ownerEmail`, `reason`, `urgency`, `model`, `batch`, `colour`, `panel` | Logger fields |
| `warehouse`, `factory` | Routing (AKS/KAZ/…) |
| `status`, `tracking`, `deadline` | Workflow |
| `sourceRpId`, `sourceRpNum`, `sourceLineItemId` | Link back to RP |
| `workshopNote`, `orderSentAt` | Factory columns |
| `syncedAt` | Sheet backup timestamp |

### `RpPhoto` → `rp_photos`

Blob storage metadata for RP issue photos.

| Field | Notes |
|-------|--------|
| `storageKey`, `url` | Vercel Blob |
| `label`, `mimeType`, `byteSize` | Metadata |

## Sync & automation tables

### `RpSheetSyncOutbox` → `sheet_sync_outbox`

Pending sheet writes. Cron `sheet-sync` processes `status: pending`.

| Field | Notes |
|-------|--------|
| `entityType` | `"rp"` \| `"ip"` |
| `entityId` | Cuid of request/IP row |
| `operation` | Usually `upsert` |
| `status` | `pending` → `processing` → `synced` \| `failed` |

Created by `enqueueSheetSync()` in `src/lib/domain/panel-orders.ts`.

### `RpSheetRowMap` → `sheet_row_map`

Maps Neon entity → Google Sheet row number per tab name.

### `RpAutomationState` → `automation_state`

Key/value for cron bots (last run markers, dedup state).

### `RpExportTrackingRow` → `export_tracking_rows`

External export tracking text; `export-sync` cron copies to `RpRequest.tracking`.

## Reference / sequence tables

| Table | Purpose |
|-------|---------|
| `RpAddressBookEntry` | Cached address book (also loaded from Google Sheet) |
| `RpPanelCatalogOption` | Panel catalogue options |
| `RpNumSequence` | Atomic RP number minting (`rp-numbers.ts`) |
| `RpIpNumSequence` | Atomic IP number minting (`ip-numbers.ts`) |

## Gateway tables (shared Neon, not RP-specific)

Used by this app but owned by gateway:

- `User` — must exist for Google login
- `ToolCardAccess` — `userId` + `cardId` (`RP_TOOL_CARD_ID`) required for app access

## Sheet column mapping

DB fields ↔ Rep.Parts26 columns: `src/lib/integrations/rp-sheet-columns.ts`.

Do not duplicate column indices in docs — import `RP_COLUMN` / `IP_COLUMN` in code.

Example mapping (RP):

| DB field | `RP_COLUMN` key | Sheet letter (1-based) |
|----------|-----------------|------------------------|
| `rpNum` | `RP_NUM` | A |
| `market` | `MARKET` | D |
| `userId` | `USER_ID` | E |
| `reviewGroup` | `REVIEW_GROUP` | V |
| `status` | `STATUS` | X |
| `workshopNote` | `WORKSHOP_NOTE` | AD (index 29) |
| `orderSentAt` | `ORDER_SENT` | AE (index 30) |

## Schema change workflow

1. Change models in **meavo-db** repo
2. Tag release (e.g. `v0.8.0`)
3. Bump `@meavo/db` git ref in this repo's `package.json`
4. `npm install` → `prisma generate` (via postinstall)
5. Deploy — Neon already migrated from meavo-db pipeline

`npm run db:push` is intentionally disabled in this repo.
