# Agent guide — meavo-rp

Quick orientation for AI agents working in this repo. Read this before exploring blindly.

**Cursor:** `.cursor/rules/core.mdc` and `security.mdc` are always applied; `ui.mdc`, `domain.mdc`, `api.mdc`, `legacy.mdc` attach by path. Org-wide conventions: [meavo-agent-templates STANDARDS.md](https://github.com/meavo-booths/meavo-agent-templates/blob/main/STANDARDS.md).

## What this app does

**rp.meavo.app** — spare parts and panel order operations for Meavo booth service teams.

- Field staff **log RPs** (replacement part / panel requests) and **IPs** (internal production rows)
- Reviewers and factory leads **manage dashboards** by role (Anna, Nikolay, Stefan, logistics, urgent panels, etc.)
- **Neon Postgres** (`@meavo/db`) is the system of record
- **Rep.Parts26** Google Sheet is an async write-only backup (cron every 5 min)
- **legacy-gas/** holds the old Apps Script app for parity reference only

## Stack

Next.js 15 App Router · React 19 · TypeScript · Tailwind 3 · Prisma 6 via `@meavo/db` (shared Neon) · NextAuth v5 (Google) + gateway `ToolCardAccess` · Vercel (fra1) + Vercel Blob · `googleapis` sheet backup · Slack bot · `@meavo/navigation` header.

## Commands

```bash
npm install
npm run dev          # http://localhost:3003
npm run typecheck    # tsc --noEmit — the CI gate (no test suite)
npm run build        # prisma generate + next build
```

## First files to read

| Task | Start here |
|------|------------|
| New dashboard feature | `docs/domain.md` → persona table → matching `src/app/(app)/dashboard/*/page.tsx` |
| RP create/edit/cancel | `src/lib/domain/rp-create.ts`, `rp-update.ts`, `src/app/actions/rp.ts` |
| Dashboard mutation | `src/lib/domain/rp-mutations.ts` or `ip-mutations.ts` → `src/app/actions/rp-mutations.ts` |
| Who can do what | `src/lib/domain/authz.ts`, `src/lib/viewer-context.ts` |
| Sheet sync | `src/lib/domain/panel-orders.ts` (`enqueueSheetSync`), `src/lib/integrations/sheet-sync.ts` |
| Sheet columns | `src/lib/integrations/rp-sheet-columns.ts`, `src/lib/integrations/sheet-row-mapper.ts` |
| Cron / Slack | `vercel.json`, `src/app/api/cron/`, `src/lib/integrations/slack/` |
| Reference data (catalogue, markets, addresses) | `src/lib/reference-data/` |
| DB schema | `docs/data-model.md` (schema lives in meavo-db) |
| Match legacy GAS | `legacy-gas/WebAppLogic.js`, `legacy-gas/LoggerLogic.js` |
| Catalogue / MRP deduct | `docs/rp-mrp-materials.md`, `src/lib/domain/catalogue-mrp.ts`, `/admin/catalogue` |

## Do NOT

1. Run `npm run db:push` or edit the Prisma schema here — schema changes go in **meavo-db**
2. Use ES module `import`/`export` in files that must run in GAS (`legacy-gas/` only)
3. Treat `legacy-gas/` as the live app — it is read-only parity reference
4. Import `@/lib/auth` (Prisma) from `middleware.ts` — use `@/lib/auth.config` (edge-safe)
5. Skip `enqueueSheetSync` after Prisma writes that should reach Rep.Parts26
6. Bypass automation toggles (`/admin/automations`, `RP_NOTIFICATIONS_FORCE_OFF`) for Slack/sheet side effects
7. Add external UI libraries — in-house kit (`src/components/ui.tsx`) + `@meavo/navigation` only
8. Translate Bulgarian UI strings — intentional; keep existing language unless asked

## Conventions

1. **Domain logic in `src/lib/domain/`** — keep route handlers and Server Actions thin
2. **Server Actions** use `requireActionSession()` from `src/lib/api/require-session.ts`; pages gate via `requireRpAccess()` (`src/lib/meavo-auth.ts`)
3. **Revalidate** dashboard paths after mutations (`revalidatePath` in actions)
4. **No schema changes here** — bump `@meavo/db` git ref in `package.json` after a meavo-db release
5. Vercel deploys automatically on push to `main` — do not run manual CLI deploys

## Scoped task template (preferred from user)

```
Persona/route: /dashboard/stefan
Behaviour: [what should happen]
Legacy reference: legacy-gas/WebAppLogic.js functionName (if any)
Out of scope: [sheet sync / auth / other dashboards]
```

## Production status

Migration from GAS is largely complete (see README migration checklist). GAS web app runs in parallel until persona sign-off, then GAS deployment is disabled.

## Related docs

- [docs/architecture.md](docs/architecture.md) — stack, siblings, data flow
- [docs/domain.md](docs/domain.md) — personas, glossary, mutations, status machine
- [docs/data-model.md](docs/data-model.md) — Prisma tables used by this app
- [CONTRIBUTING.md](CONTRIBUTING.md) — PR process
