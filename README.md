# meavo-rp

Spare parts & panel order operations for Meavo — **rp.meavo.app**.

Shared Neon Postgres (via `@meavo/db`) is the system of record. The existing **Rep.Parts26** Google Sheet receives async one-way backup writes.

## Stack

- Next.js 15 (App Router)
- Prisma + `@meavo/db` (shared MEAVO database)
- NextAuth (Google) + gateway `User` / `ToolCardAccess`
- `@vercel/blob` for RP photos
- `pdf-lib` for Stefan panel PDF export
- `googleapis` for sheet backup

See [docs/architecture.md](docs/architecture.md) for sibling-repo audit and composite choices.

## Setup

```bash
cp .env.example .env.local
# Fill DATABASE_URL, AUTH_*, RP_TOOL_CARD_ID, GOOGLE_SERVICE_ACCOUNT_JSON,
# REP_PARTS_SPREADSHEET_ID, BLOB_READ_WRITE_TOKEN, SLACK_BOT_TOKEN (optional)

npm install
npm run dev              # http://localhost:3003
```

Schema changes belong in [meavo-db](https://github.com/meavo-booths/meavo-db) — not in this repo. `npm run db:push` is disabled here on purpose.

## Import from Google Sheets (one-time)

```bash
npm run import:sheets
```

**IP rows:** If the spreadsheet has no tab named `Internal Production`, set `INTERNAL_PRODUCTION_SHEET_NAME` in env to the correct tab name before import/sync.

## Cron routes (Vercel)

| Path | Schedule |
|------|----------|
| `/api/cron/sheet-sync` | every 5 min |
| `/api/cron/unbriefed-panels` | every 15 min |
| `/api/cron/kaz-panel-slack` | every 2 hours |
| `/api/cron/rp-slack` | every 10 min |
| `/api/cron/factory-fill` | daily 06:00 UTC |
| `/api/cron/export-sync` | daily 07:00 UTC |
| `/api/cron/var-panel-slack` | Mon 09:00 UTC |

Protect with `Authorization: Bearer $CRON_SECRET`.

## Migration status

- [x] Repo scaffold + Prisma via `@meavo/db`
- [x] Gateway Google auth + tool-card DB re-check
- [x] Phase 1.5: Server Actions, MeavoNavBar, ui kit, health probe, authz parity
- [x] Phase 2: Role dashboards (Nikolay, Stefan, Anna, logistics, urgent, Ivan, Todor, Kalin)
- [x] Phase 2: Dashboard mutations + sheet sync outbox
- [x] Phase 2: IP logger at `/log/ip`
- [x] Phase 3: Regional scopes, Kalin modes, Todor export views, Stefan PDF export
- [x] Phase 4: RP edit/similar, catalogue modal, Blob photos, factory-fill + export crons
- [x] Phase 5: Slack cron routes + `vercel.json` schedules
- [ ] Production cutover (parallel validation, disable GAS web app)

## Production cutover checklist

Run **rp.meavo.app** in parallel with GAS until each persona signs off:

1. **Env on Vercel:** `DATABASE_URL`, `AUTH_*`, `RP_TOOL_CARD_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (valid single-line JSON), `REP_PARTS_SPREADSHEET_ID`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `SLACK_BOT_TOKEN`
2. **Smoke per persona:** standard logger + dashboard, Anna ready/ship, Nikolay IP, Stefan workshop note + PDF, logistics read-only, Kalin AUP, Todor export/topoli, Ivan read-only
3. **Sheet sync:** confirm cron writes match Rep.Parts26 columns A–AE; check lag < 10 min
4. **Slack:** verify unbriefed/KAZ/VAR/RP bots post to correct channels (set `SLACK_*_CHANNEL` env vars as needed)
5. **Disable GAS:** stop web app deployment; keep sheet as backup; document in ops runbook

## GAS reference

Copy Apps Script sources into `legacy-gas/` before porting domain logic. See `legacy-gas/README.md`.
