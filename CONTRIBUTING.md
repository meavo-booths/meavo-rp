# Contributing — meavo-rp

## Before you open a PR

- [ ] Changes are scoped to the request — no drive-by refactors
- [ ] `npm run typecheck` passes (no test suite — document the manual check you ran)
- [ ] Agent docs updated if you added routes, domain modules, crons, or auth rules
- [ ] `enqueueSheetSync("rp"|"ip", entityId)` called after Prisma writes that must reach Rep.Parts26
- [ ] New Slack/sheet automations respect the admin automation toggles and `RP_NOTIFICATIONS_FORCE_OFF`

## Branch naming

`feature/short-description`, `fix/short-description`, `docs/short-description`.

## Commit messages

Imperative mood, complete sentences, body bullets for multi-part changes: `Fix GAS parity gaps: AUP buckets, Todor week filter.`

## Code placement

| Layer | Location |
|-------|----------|
| Pages / dashboards | `src/app/(app)/`, `src/components/dashboard/` |
| Server Actions / API routes | `src/app/actions/`, `src/app/api/` |
| Business logic | `src/lib/domain/` |
| Sheet / Slack integrations | `src/lib/integrations/` |

## Cross-repo dependencies

`@meavo/db` and `@meavo/navigation` are pinned git refs in `package.json`. To bump: release/tag in the source repo, update the ref here, `npm install`, verify `npm run typecheck` and build.

## Schema changes

Only in [meavo-db](https://github.com/meavo-booths/meavo-db) — edit schema there, tag a release, bump the `@meavo/db` ref here, redeploy. `npm run db:push` is intentionally disabled in this repo.

## PR description

Include:

1. **What** changed (user-visible or API behaviour)
2. **Why** (link issue if any)
3. **How to verify** (commands or manual steps — name the persona/dashboard for UI changes)
4. **Out of scope** (what you intentionally did not change)

## Agent-assisted PRs

If an AI agent wrote the code:

- Verify paths and business rules against `docs/domain.md`
- Reject unfilled template placeholder comments in merged files
- Ensure no secrets in diff
- For GAS-parity work, spot-check behaviour against `legacy-gas/` sources
