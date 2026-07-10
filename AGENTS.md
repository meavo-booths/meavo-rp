# Agent guide — meavo-rp

Quick orientation for AI agents working in this repo. Read this before exploring blindly.

**Cursor:** `.cursor/rules/meavo-rp.mdc` is always applied — it maps natural-language tasks to the right files so the user does not need to cite these docs. Domain/action patterns: `.cursor/rules/meavo-rp-domain.mdc`.

## What this app does

**rp.meavo.app** — spare parts and panel order operations for Meavo booth service teams.

- Field staff **log RPs** (replacement part / panel requests) and **IPs** (internal production rows)
- Reviewers and factory leads **manage dashboards** by role (Anna, Nikolay, Stefan, logistics, urgent panels, etc.)
- **Neon Postgres** (`@meavo/db`) is the system of record
- **Rep.Parts26** Google Sheet is an async write-only backup (cron every 5 min)
- **legacy-gas/** holds the old Apps Script app for parity reference only

## First files to read

| Task | Start here |
|------|------------|
| New dashboard feature | `docs/domain.md` → persona table → matching `src/app/(app)/dashboard/*/page.tsx` |
| RP create/edit/cancel | `src/lib/domain/rp-create.ts`, `rp-update.ts`, `src/app/actions/rp.ts` |
| Dashboard mutation | `src/lib/domain/rp-mutations.ts` or `ip-mutations.ts` → `src/app/actions/rp-mutations.ts` |
| Who can do what | `src/lib/domain/authz.ts`, `src/lib/viewer-context.ts` |
| Sheet sync | `src/lib/domain/panel-orders.ts` (`enqueueSheetSync`), `src/lib/integrations/sheet-sync.ts` |
| Sheet columns | `src/lib/integrations/rp-sheet-columns.ts`, `sheet-row-mapper.ts` |
| Cron / Slack | `vercel.json`, `src/app/api/cron/*/route.ts`, `src/lib/integrations/slack/` |
| DB schema | `docs/data-model.md` or `node_modules/@meavo/db/prisma/schema.prisma` (Rp* models) |
| Match legacy GAS | `legacy-gas/WebAppLogic.js`, `legacy-gas/LoggerLogic.js` |

## Conventions

1. **Domain logic in `src/lib/domain/`** — keep route handlers and Server Actions thin
2. **Mutations enqueue sheet sync** — call `enqueueSheetSync` after Prisma writes that should reach Rep.Parts26
3. **Server Actions** use `requireActionSession()` from `src/lib/api/require-session.ts`
4. **Revalidate** dashboard paths after mutations (`revalidatePath` in actions)
5. **No schema changes here** — bump `@meavo/db` git ref in `package.json` after meavo-db release
6. **Bulgarian UI strings** in components are intentional; keep existing language unless asked

## Scoped task template (preferred from user)

```
Persona/route: /dashboard/stefan
Behaviour: [what should happen]
Legacy reference: legacy-gas/WebAppLogic.js functionName (if any)
Out of scope: [sheet sync / auth / other dashboards]
```

## Production status

Migration from GAS is largely complete (see README migration checklist). GAS web app should run in parallel until persona sign-off, then disable GAS deployment.

## Related docs

- [docs/architecture.md](docs/architecture.md)
- [docs/domain.md](docs/domain.md)
- [docs/data-model.md](docs/data-model.md)
