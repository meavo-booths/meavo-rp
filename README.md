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

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/architecture.md](docs/architecture.md) | Stack, repo layout, data flow, API surface |
| [docs/domain.md](docs/domain.md) | Personas, glossary, mutations, GAS port index |
| [docs/data-model.md](docs/data-model.md) | Prisma tables (`RpRequest`, sync outbox, …) |
| [AGENTS.md](AGENTS.md) | Quick orientation for AI coding agents |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branching, PR checklist, cross-repo bumps |
| [.cursor/rules/](.cursor/rules/) | Always-on Cursor rules (core, security) + path-scoped (ui, domain, api, legacy) |

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

Schedules below are **UTC**. Sofia is UTC+3 in summer → Mon 06:00 UTC = Mon 09:00 Sofia.

| Path | Schedule |
|------|----------|
| `/api/cron/sheet-sync` | every 5 min |
| `/api/cron/unbriefed-panels` | every 15 min |
| `/api/cron/kaz-panel-slack` | every 2 hours |
| `/api/cron/kaz-weekly-standard` | Mon 06:00 UTC |
| `/api/cron/kaz-standard-workshop` | daily 07:00 UTC |
| `/api/cron/rp-slack` | every 10 min |
| `/api/cron/factory-fill` | daily 06:00 UTC |
| `/api/cron/export-sync` | daily 07:00 UTC |
| `/api/cron/var-panel-slack` | Mon 06:00 UTC |
| `/api/cron/factory-deadline-slack` | Mon–Fri 07:30 UTC |

Protect with `Authorization: Bearer $CRON_SECRET`.

**Automation source toggles:** `/admin/automations` (admin only). Each function defaults to **GAS** — Next.js crons and mutation Slack hooks no-op until flipped to **Webapp**. Keep them on GAS while testing the webapp so Slack is not duplicated. Set `RP_NOTIFICATIONS_FORCE_OFF=true` for emergency kill-switch.

### GAS → Webapp cutover matrix

| Automation key | GAS script | Disable GAS trigger |
|----------------|------------|---------------------|
| `unbriefed_slack` | `UnbriefedUrgentPanelSlackBot.js` | Time-driven every 15 min |
| `kaz_panel_slack` | `KazPanelOrderSlackAutomation.js` | Every 2h + Mon 09:00 + daily 10:00 |
| `var_panel_slack` | `VarPanelOrderSlackAutomation.js` | Monday 09:00 |
| `rp_slack` | `RPSlackBot.js` | onEdit + time-driven sweeps |
| `factory_deadline_slack` | `RPSlackBot.js` (factory deadline) | Daily 10:30 Mon–Fri |
| `factory_fill` | `FactoryFillAutomation.js` | onEdit + daily 06:00 |
| `export_sync` | `ExportAutomation.js` | Daily |

**Smoke after each flip:** hit the matching `/api/cron/*` with `CRON_SECRET`, verify Vercel logs show `skipped: false`, confirm no duplicate Slack for 48h, then disable the GAS trigger row above.

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
- [x] Phase 6: Admin automation toggles + full Slack/factory/export ports
- [ ] Production cutover (flip automations one-by-one, disable GAS triggers)

## Production cutover checklist

Run **rp.meavo.app** in parallel with GAS until each persona signs off:

1. **Env on Vercel:** `DATABASE_URL`, `AUTH_*`, `RP_TOOL_CARD_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (valid single-line JSON), `REP_PARTS_SPREADSHEET_ID`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `SLACK_BOT_TOKEN`
2. **Smoke per persona:** standard logger + dashboard, Anna ready/ship, Nikolay IP, Stefan workshop note + PDF, logistics read-only, Kalin AUP, Todor export/topoli, Ivan read-only
3. **Sheet sync:** confirm cron writes match Rep.Parts26 columns A–AE; check lag < 10 min
4. **Automations:** open `/admin/automations`; keep rows on **GAS** until cutover (avoids duplicate Slack). Flip one row GAS → Webapp only when ready; then disable the matching GAS trigger; smoke-test for 48h
5. **Disable GAS:** when all rows = Webapp, stop GAS web app; keep sheet as backup; document in ops runbook

## GAS reference

Copy Apps Script sources into `legacy-gas/` before porting domain logic. See `legacy-gas/README.md`.
