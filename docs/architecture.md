# meavo-rp architecture

RP spare-parts / panel operations app at **rp.meavo.app**. Neon Postgres (shared MEAVO database via `@meavo/db`) is the system of record; **Rep.Parts26** Google Sheet is an async write-only backup.

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

## Data flow

```
Browser → Next.js API → Neon (read/write via Prisma)
                      → Blob (photos/PDFs)
                      → sheet_sync_outbox → worker → Rep.Parts26 (backup)
Slack crons → Neon collectors → Slack API
```

## GAS port reference

Copy Apps Script sources into `legacy-gas/` for porting. See `legacy-gas/README.md`.
