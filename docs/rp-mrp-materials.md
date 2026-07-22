# RP materials deduction (MRP bridge)

Operators can browse the spare-parts and panel catalogues, map them to MRP
materials / booth-element recipes, and deduct stock for **Ready** RPs.

## Where

| App | Role |
|-----|------|
| **rp.meavo.app** `/catalogue` | Parts list, panels list, mapping CRUD, Ready deduct queue |
| **mrp.meavo.app** `POST /api/stock/rp-deduct` | Resolves maps / BOMs and posts `production_out` movements |

Access on RP: admins + Anna, Nikolay, Stefan, Kalin, Yavor.

## Mapping

- **Parts**: `RpPartMrpMap` (`partRpCode` → `MrpMaterial`). Deduction also falls back to `MrpMaterial.code === partRpCode` when no map row exists. Prefer explicit maps; use **Link by equal code** on the Mappings tab.
- **Panels**: `RpPanelMrpMap` (`boothModelName` + `rpPanelName` → `MrpBoothElement`). Deduction also tries exact `simpleName` match. Use **Seed exact name matches** or `npx tsx scripts/seed-panel-mrp-maps.ts`.

Panel BOM resolution uses RP `color` + market (US vs default) the same way packing-element recipes do in MRP.

## Deduction rules

- Only lines whose parent RP `status === "Ready"`.
- Explicit action (Ready tab → Deduct selected) — not automatic on Ready mark.
- Panel lines with `fulfillment === from_stock` are skipped (marked deducted without stock movement).
- Warehouse from `reviewGroup` → AKS / VAR / KAZ / TOP.
- Idempotent via `RpLineItem.materialsDeductedAt`.

## Env

Both apps need the same shared secret:

```
RP_MRP_DEDUCT_SECRET=<long random>
```

RP also needs (optional override):

```
MRP_APP_URL=https://mrp.meavo.app
```

## Schema

`@meavo/db` ≥ `v0.26.0` — see `scripts/add-rp-mrp-maps.sql` in meavo-db.
