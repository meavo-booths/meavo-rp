# Post-bootstrap checklist

Run after filling templates in a target repo.

## Files exist

- [ ] `AGENTS.md`
- [ ] `.cursor/rules/core.mdc` with `alwaysApply: true`
- [ ] `.cursorignore`
- [ ] `CONTRIBUTING.md` (or consciously skipped with reason in PR)
- [ ] `docs/architecture.md` (or N/A noted in PR)
- [ ] `docs/domain.md` (if app has business rules)
- [ ] `docs/data-model.md` (if app uses a database)

## Content quality

- [ ] `grep -r "FILL:" AGENTS.md .cursor docs CONTRIBUTING.md` returns nothing
- [ ] `AGENTS.md` is under ~150 lines
- [ ] Task → file table has ≥8 rows; every path exists
- [ ] Do NOT section has 5–10 real constraints
- [ ] Dev/test/lint/build commands match `package.json` (or equivalent)
- [ ] README links to `AGENTS.md` and `docs/`

## Cursor rules

- [ ] No contradictory duplicate of `.cursorrules` (merged or removed)
- [ ] `domain.mdc` globs match actual domain directory (or file deleted)
- [ ] `api.mdc` globs match routes/actions directory (or file deleted)

## Accuracy spot-checks

- [ ] Auth: correct gate function / middleware named
- [ ] Schema: correct owner repo (`meavo-db` vs local)
- [ ] Cron: paths and schedules match `vercel.json` / scheduler config
- [ ] Integrations: only document what this repo actually calls

## Agent smoke test

Paste to a fresh agent session in the target repo:

```
Where should I add a new dashboard mutation? What must I call after a DB write that should sync externally?
```

Expected: agent cites `AGENTS.md` / `docs/domain.md` with **this repo's** paths — not another Meavo app.
