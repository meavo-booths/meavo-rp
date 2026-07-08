# meavo-rp

Spare parts & panel order operations for Meavo — **rp.meavo.app**.

Shared Neon Postgres (via `@meavo/db`) is the system of record. The existing **Rep.Parts26** Google Sheet receives async one-way backup writes.

## Stack

- Next.js 15 (App Router)
- Prisma + `@meavo/db` (shared MEAVO database)
- NextAuth (Google) + gateway `User` / `ToolCardAccess`
- `@vercel/blob` for photos/PDFs
- `googleapis` for sheet backup

See [docs/architecture.md](docs/architecture.md) for sibling-repo audit and composite choices.

## Setup

```bash
cp .env.example .env.local
# Fill DATABASE_URL (shared Neon), AUTH_*, RP_TOOL_CARD_ID, GOOGLE_SERVICE_ACCOUNT_JSON, REP_PARTS_SPREADSHEET_ID

npm install
npm run dev              # http://localhost:3003
```

Schema changes belong in [meavo-db](https://github.com/meavo-booths/meavo-db) — not in this repo. `npm run db:push` is disabled here on purpose.

## Import from Google Sheets (one-time)

```bash
npm run import:sheets
```

## GAS reference

Copy Apps Script sources into `legacy-gas/` before porting domain logic. See `legacy-gas/README.md`.

## Cron routes (Vercel)

| Path | Schedule |
|------|----------|
| `/api/cron/sheet-sync` | every 5 min |
| `/api/cron/unbriefed-panels` | every 15 min |
| `/api/cron/kaz-panel-slack` | every 2 hours |

Protect with `Authorization: Bearer $CRON_SECRET`.

## Migration status

- [x] Repo scaffold + Prisma via `@meavo/db`
- [x] Gateway Google auth + tool-card access
- [x] Phase 1: Logger (3-step wizard) + standard/reviewer dashboard
- [x] Sheet sync worker + import script
- [ ] Phase 2: Reviewer-specific dashboards (Nikolay, Stefan, Anna actions)
- [ ] Phase 3: Logistics, urgent panels, Todor, Ivan, regional
- [ ] Phase 4: Slack automations + panel order PDFs
- [ ] Photos (Blob), catalogue modal, RP edit flow
- [ ] Production cutover (disable GAS web app)
