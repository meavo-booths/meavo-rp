# meavo-rp architecture

RP spare-parts / panel operations app at **rp.meavo.app**. Neon Postgres (shared MEAVO database via `@meavo/db`) is the system of record; **Rep.Parts26** Google Sheet is an async write-only backup.

**Further reading:**
- [domain.md](domain.md) — personas, glossary, mutation map, GAS port index
- [data-model.md](data-model.md) — Prisma tables used by this app
- [AGENTS.md](../AGENTS.md) — quick orientation for AI agents

## Sibling audit (meavo-booths org)

| Repo | Stack | Borrowed for meavo-rp |
|------|-------|---------------------|
| **sales** | Next 15, Prisma + `@meavo/db`, NextAuth Google, `googleapis` Sheets, `@vercel/blob`, `@meavo/navigation` | **Primary scaffold**: auth layout, middleware, `sheets-client`, app `(app)/` structure |
| **meavo-gateway** | Prisma, NextAuth, `vercel.json` crons, `pdf-lib` | Cron route pattern, tool-card access |
| **meavo-mrp** | Next 16, **Prisma** + `@meavo/db`, Zod `env.ts`, `lib/domain` | **Database layer**: Prisma client, env validation, domain module layout |
| **meavo-db** | Canonical Prisma schema for shared Neon | **RP tables** (`RpRequest`, `RpLineItem`, …) live here; apps run `prisma generate` only |

## Composite decisions

- **ORM**: Prisma via `@meavo/db` (same shared Neon as gateway, sales, hols, MRP).
- **Schema changes**: Only in [meavo-db](https://github.com/meavo-booths/meavo-db) — tag a release, bump the git ref in `package.json`, redeploy.
- **Auth**: NextAuth v5 + Google; gateway `User` must exist; access gated by `ToolCardAccess` for `RP_TOOL_CARD_ID` (default `seed-rp-tool`).
- **Files**: `@vercel/blob` (same as sales/gateway).
- **Sheets backup**: `googleapis` service account — adapted from `sales/src/lib/sheets-client.ts`.
- **Navigation**: `@meavo/navigation` shared header.
- **Jobs**: Vercel Cron (`vercel.json`) — paths under `/api/cron/*`, `CRON_SECRET` header.

## Repository layout

```
src/
  app/
    (app)/              # Authenticated pages (dashboard, log)
    actions/            # Server Actions (thin wrappers)
    api/                # REST + cron + auth routes
  components/
    dashboard/          # Role-specific dashboard UI
    logger/             # RP/IP logger wizards
  lib/
    domain/             # Business logic (start here for behaviour changes)
    integrations/       # Sheets, Slack, sheet-sync worker
    reference-data/     # Catalogue, address book, panel options
    viewer-context.ts   # Role resolution + admin simulate
legacy-gas/             # Read-only GAS reference for parity
docs/                   # architecture, domain, data-model
```

## Data flow

```
Browser → Server Actions / API → Neon (read/write via Prisma)
                               → Blob (photos/PDFs)
                               → sheet_sync_outbox → cron sheet-sync → Rep.Parts26 (backup)
Slack crons → Neon collectors → Slack API
```

Mutations that should reach the sheet call `enqueueSheetSync()` (`src/lib/domain/panel-orders.ts`).

## API surface

| Type | Examples |
|------|----------|
| Server Actions | `src/app/actions/rp.ts`, `rp-mutations.ts` |
| User API | `/api/rp`, `/api/address-book`, `/api/panel-options`, `/api/dashboard/parts` |
| Admin/dev | `/api/simulate-email`, `/api/stefan/panels-pdf` |
| Cron | `/api/cron/sheet-sync`, `factory-fill`, `export-sync`, `*-slack`, `unbriefed-panels` |
| Auth | `/api/auth/[...nextauth]` |
| Health | `/api/health` |

Cron schedules: `vercel.json`. Auth: `Authorization: Bearer $CRON_SECRET`.

## Auth flow

```
Google OAuth → NextAuth session → requireRpAccess()
  → ToolCardAccess check (RP_TOOL_CARD_ID)
  → resolveViewerContext() → role + default dashboard path
```

Admins can set cookie `rp_simulate_email` to act as another `@meavo.com` user (inline simulate in the admin chrome bar).

## GAS port reference

Copy Apps Script sources into `legacy-gas/` for porting. See `legacy-gas/README.md`.

Function-level mapping to Next.js modules: [domain.md — Legacy GAS → Next.js port index](domain.md#legacy-gas--nextjs-port-index).

## Environment

See `.env.example`. Critical vars: `DATABASE_URL`, `AUTH_*`, `RP_TOOL_CARD_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `REP_PARTS_SPREADSHEET_ID`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `SLACK_BOT_TOKEN`.

Validated in `src/lib/env.ts` (`loadServerEnv`).
