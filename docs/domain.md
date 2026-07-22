# Domain reference — meavo-rp

Business rules, personas, statuses, and a map of **where to change what**. For stack and repo layout see [architecture.md](architecture.md). For Prisma tables see [data-model.md](data-model.md).

## Glossary

| Term | Meaning |
|------|---------|
| **RP** | Replacement Parts request — one header row (`RpRequest`) in Neon, one row in Rep.Parts26 tab. May have multiple line items (`RpLineItem`) for multi-panel orders. |
| **IP** | Internal Production row (`RpInternalProductionRow`) — factory/warehouse production tracking, separate sheet tab. |
| **Review group** | Factory routing code on an RP, e.g. `AKS`, `KAZ`, `VAR`. Stored in `reviewGroup`. Often auto-filled from booth batch via factory-fill cron. |
| **Item type** | Column K / `itemType` — e.g. panel names, `PART`, `PARTS`, `STOCK`, `SPARE`. Drives deadlines, logistics filters, and reviewer visibility. |
| **Logger** | Form at `/log` (RP) or `/log/ip` (IP) for creating entries. |
| **Briefed** | Default active status for panel RPs once factory is assigned. |
| **Ready** | Part ready for logistics shipment (Anna) or urgent panel ready for pallet/container (Kalin/Yavor). |
| **Order sent** | `orderSentAt` set — panel order emailed to factory; sheet column AE / IP equivalent. |
| **Workshop note** | `workshopNote` — factory instruction; sheet AD. Special value `Не произвеждай!` when all panels taken from stock. |
| **AUP** | Active Urgent Panels — Kalin/Yavor workflow for urgent panel RPs. |
| **Regional scope** | Market filter for standard dashboard users (e.g. `uk`, `iberia`, `all_markets`). |

## RP status values (common)

| Status | Typical meaning |
|--------|-----------------|
| *(empty)* or `Briefed` | Active panel, factory assigned or awaiting production |
| `In Production` | Urgent panel briefed with production ETA |
| `Ready` | Ready for logistics / shipment |
| `Shipped` | Shipped (parts or panels) |
| `Cancelled` | Owner cancelled within rules |
| `Delayed` | Due date changed with reason |
| `Ordered on Amazon` | Treated like archive for standard views |

IP statuses: active flow uses `Ready`, terminal uses `Shipped` / `Delivered` / `Cancelled`.

## Persona → route → permissions

Resolved in `src/lib/viewer-context.ts` (`resolveViewerRole`) and `src/lib/domain/authz.ts`.

| Email / role | Default route | What they see | Mutations |
|--------------|---------------|---------------|-----------|
| **Regional staff** (Hedi, Carla, Vojtech, …) | `/dashboard` | Own RPs + RPs in their `regionalScopes` | Create/edit own RP (2h window), cancel own, similar RP |
| **anna@meavo.com** (reviewer) | `/dashboard` | AKS + VAR; item types PART/PARTS/STOCK only | Mark ready for logistics, revert ready, ship from ready tab |
| **nikolay@meavo.com** | `/dashboard/nikolay` | AKS panels (excl. parts/stock/spare) + AKS IP | IP mark ready for warehouse; workshop note; due date |
| **stefan@meavo.com** | `/dashboard/stefan` | KAZ panels + KAZ IP; ready/archive views | Same IP actions for KAZ; workshop note; Stefan PDF export |
| **kalin@meavo.com** | `/dashboard/kalin` | AUP default; modes: `aup`, `all`, `own` | Brief urgent panel, ETA, mark ready, stock replacement |
| **yavor@meavo.com** | `/dashboard/urgent-panels` | Urgent panels (all factories) | Same urgent-panel mutations as Kalin AUP |
| **georgi.stoyanov@**, **nikola@** (logistics) | `/dashboard/logistics` | PART/PARTS/STOCK only | **Read-only** in current Next port |
| **ivan@meavo.com** | `/dashboard/ivan` | All parts views | **Read-only** |
| **todor.dimitrov@meavo.com** | `/dashboard/todor` | Export schedule + Topoli IP stock | IP delivered at Topoli |
| **boyan@**, **todor@** (admin) | `/admin/dashboard` (+ inline simulate) | Any persona via simulate cookie | All actions as simulated user |
| **Everyone with tool access** | `/log`, `/log/ip` | Logger wizards | Create RP/IP |

### Reviewer dashboard config

Defined in `REVIEWER_DASHBOARD_CONFIGS` (`authz.ts`):

- **Anna**: groups `AKS`, `VAR`; types `PART`, `PARTS`, `STOCK`
- **Nikolay**: group `AKS`; all types except PART/PARTS/STOCK/SPARE; merges IP
- **Stefan**: group `KAZ`; all types; merges IP

Nikolay/Stefan pages use dedicated routes; Anna uses generic `/dashboard` with reviewer filtering in `getDashboardParts`.

### Regional scopes

`STANDARD_REGIONAL_SCOPES` in `authz.ts`. Matching logic: `src/lib/domain/regional-markets.ts` (`matchesRegionalScope`).

## Routes reference

| Path | Page component | Data source |
|------|----------------|-------------|
| `/log` | `LoggerWizard` | `rp-create`, `rp-update`, reference sheets |
| `/log/ip` | `IpLoggerWizard` | `ip-create` |
| `/dashboard` | `PartsDashboard` | `dashboard-parts` |
| `/dashboard/nikolay` | RP + `RoleIpDashboard` | `dashboard-parts`, `dashboard-ip` |
| `/dashboard/stefan` | PDF + RP + IP | + `stefan-panel-pdf` |
| `/dashboard/kalin` | AUP / all / own | `dashboard-urgent`, `dashboard-parts` |
| `/dashboard/urgent-panels` | `UrgentPanelsDashboard` | `dashboard-urgent` |
| `/dashboard/logistics` | `LogisticsDashboard` | `dashboard-logistics` |
| `/dashboard/ivan` | `PartsDashboard` (read-only UI) | `dashboard-parts` |
| `/dashboard/todor` | Export / Topoli | `dashboard-todor` |

## Mutation map — where to change what

### RP lifecycle

| Action | Domain | Server Action | UI |
|--------|--------|---------------|-----|
| Create RP | `rp-create.ts` | `createRpAction` | `logger-wizard.tsx` |
| Edit RP (2h, owner) | `rp-update.ts` | `updateRpAction` | `/log?editRp=` |
| Similar RP | `rp-update.ts` | — | `/log?similarRp=` |
| Cancel RP | `rp-create.ts` | `cancelRpAction` | `parts-dashboard.tsx` |
| Ship RP | `rp-mutations.ts` | `shipRpAction` | Anna ready tab |
| Revert to active | `rp-mutations.ts` | `revertRpAction` | Owner, archive tab |
| Anna mark ready | `rp-mutations.ts` | `annaReadyAction` | `parts-dashboard.tsx` |
| Anna revert ready | `rp-mutations.ts` | `annaRevertReadyAction` | Anna only |
| Workshop note | `rp-mutations.ts` | `updateWorkshopNoteAction` | IP dashboard, Stefan/Nikolay |
| Due date + Delayed | `rp-mutations.ts` | `updateDueDateAction` | Dashboard cards |
| Urgent brief / ETA / ready | `rp-mutations.ts` | `briefUrgentPanelAction`, etc. | `urgent-panels-dashboard.tsx` |
| Stock replacement | `stock-replacement.ts` | `useExistingPanelAction` | Urgent panels |
| RP photos | `rp-photos.ts` | `createRpAction` | Logger upload |
| Catalogue / MRP maps | `catalogue-mrp.ts` | `catalogue-mrp.ts` actions | `/catalogue` |
| Deduct Ready materials | MRP `rp-deductions.ts` via `callMrpDeduct` | `deductMaterialsAction` | `/catalogue` Ready tab |

See also [rp-mrp-materials.md](rp-mrp-materials.md).

### IP lifecycle

| Action | Domain | Server Action |
|--------|--------|---------------|
| Create IP | `ip-create.ts` | `createIpEntryAction` |
| Nikolay IP ready | `ip-mutations.ts` | `nikolayIpReadyAction` |
| Stefan IP ready | `ip-mutations.ts` | `stefanIpReadyAction` |
| Todor Topoli delivered | `ip-mutations.ts` | `todorIpDeliveredAction` |

### Automations (crons)

| Cron path | Domain / integration | Legacy script |
|-----------|---------------------|---------------|
| `/api/cron/sheet-sync` | `integrations/sheet-sync.ts` | — |
| `/api/cron/factory-fill` | `factory-fill.ts` | `FactoryFillAutomation.js` |
| `/api/cron/export-sync` | `export-automation.ts` | `ExportAutomation.js` |
| `/api/cron/rp-slack` | `integrations/slack/rp-slack.ts` | `RPSlackBot.js` |
| `/api/cron/unbriefed-panels` | urgent collector | `UnbriefedUrgentPanelSlackBot.js` |
| `/api/cron/kaz-panel-slack` | KAZ orders | `KazPanelOrderSlackAutomation.js` |
| `/api/cron/var-panel-slack` | VAR orders | `VarPanelOrderSlackAutomation.js` |

## Data flow examples

### Anna marks part ready for logistics

```
parts-dashboard → annaReadyAction → annaMarkReadyForLogistics()
  → prisma.rpRequest.update (status=Ready, shipMethod=Pallet, readyMarkedAt)
  → enqueueSheetSync("rp", id)
  → cron sheet-sync → Rep.Parts26 row update (status W, ready col, etc.)
```

### User logs new RP

```
logger-wizard → createRpAction → processNewRpEntry()
  → prisma.rpRequest.create + rpLineItems + mintNextRpNum
  → enqueueSheetSync → sheet append via rpSheetRowMap
  → optional Blob photo upload
```

### Stefan sets workshop note on IP

```
role-ip-dashboard → updateWorkshopNoteAction → updateWorkshopNote("ip", …)
  → prisma.rpInternalProductionRow.update
  → enqueueSheetSync("ip", id)
```

## Legacy GAS → Next.js port index

Use when verifying parity. GAS files are in `legacy-gas/`.

| GAS (`WebAppLogic.js` / `LoggerLogic.js`) | Next.js |
|-------------------------------------------|---------|
| `getPartsData` | `dashboard-parts.ts` → `getDashboardParts` |
| `getLogisticsPartsData` | `dashboard-logistics.ts` |
| `getActiveUrgentPanelsData` | `dashboard-urgent.ts` |
| `getTodorDashboardData` | `dashboard-todor.ts` |
| `processNewEntry` | `rp-create.ts` → `processNewRpEntry` |
| `updateExistingEntry` | `rp-update.ts` |
| `annaMarkReadyForLogistics` | `rp-mutations.ts` |
| `briefActiveUrgentPanel` | `rp-mutations.ts` |
| `nikolayMarkIpReadyForWarehouse` | `ip-mutations.ts` |
| `updateWorkshopNoteFromWeb` | `rp-mutations.ts` → `updateWorkshopNote` |
| `COLUMN_MAP` | `rp-sheet-columns.ts` (`RP_COLUMN`) |

## Business rules worth remembering

1. **RP edit window**: Owner only, 2 hours from `entryDate`, not if Shipped/Cancelled/Ordered on Amazon (`rp-edit-window.ts`).
2. **Revert from archive**: Owner only; status becomes `Ready` if ship method is Pallet/Container, else `Briefed`.
3. **Urgent ready ship method**: USA → `Container`, else `Pallet` (`rp-header-stock.ts`).
4. **Logistics dashboard**: Only replacement parts (`PART`/`PARTS`/`STOCK`), not panels.
5. **Factory-fill cron**: Deduces `reviewGroup` from booth batch; may set status `Briefed` for panel rows missing status.
6. **Full stock replacement**: Sets workshop note `Не произвеждай!` on sheet sync (`rp-header-stock.ts`).
7. **Sheet is backup only**: Never read sheet for app logic in Next.js — always Prisma.

## Known gaps / cutover notes

- Logistics dashboard is **read-only** in Next (GAS may have had more actions).
- Ivan dashboard uses `PartsDashboard` without mutation buttons (view only).
- Production cutover checklist in root `README.md`.
- Schema changes require **meavo-db** release + bump `package.json` `@meavo/db` ref.

## External reference data

| Data | Source |
|------|--------|
| Address book | Google Sheet (`reference-data/sheets.ts`, API `/api/address-book`) |
| Panel options by model | Google Sheet (`panel-options.ts`) |
| Spare parts catalogue | `reference-data/catalogue.ts` + `/api/spare-parts/[code]` |
| Export tracking | `RpExportTrackingRow` table (populated outside this app) |

Spreadsheet IDs for address book / panel options: `src/lib/reference-data/constants.ts`.
