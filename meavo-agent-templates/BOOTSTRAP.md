# BOOTSTRAP.md — agent playbook

**Audience:** Cursor / Cloud agents bootstrapping instruction files in a meavo-booths repo.

**Input:** Target repo checkout (the app you're working in, not `meavo-agent-templates`).

**Output:** Filled `AGENTS.md`, `.cursor/rules/*`, `docs/*`, `CONTRIBUTING.md`, updated `README.md` links — as a PR.

---

## Rules

1. **Discover first, write second** — never guess paths or stack from sibling repos.
2. **General templates only** — source blanks from `meavo-booths/meavo-agent-templates`; do not clone `meavo-rp` docs wholesale.
3. **Short entry, deep links** — `AGENTS.md` stays brief; details go in `docs/`.
4. **Delete or mark N/A** — remove sections that don't apply (e.g. `data-model.md` for a CLI tool with no DB).
5. **No secrets** — document env var *names* from `.env.example`, never values.
6. **Minimal scope** — this task is documentation only unless the user asked for code changes too.

---

## Procedure

### Phase A — Setup

1. Confirm you're in the **target repo root** (has `.git`, app manifest).
2. Fetch templates:
   - If `meavo-agent-templates` is not local: `git clone https://github.com/meavo-booths/meavo-agent-templates.git /tmp/meavo-agent-templates`
   - Run: `/tmp/meavo-agent-templates/scripts/bootstrap-agent-docs.sh .`
   - Use `--force` only if replacing stale docs and the user explicitly asked.
3. Read existing `README.md`, `package.json` (or equivalent), and top-level `src/` layout.

### Phase B — Discovery checklist

Fill a scratchpad (don't commit) with:

```
Product: <!-- what does this repo do, one sentence -->
URL / deploy target: <!-- e.g. rp.meavo.app, npm package, internal cron -->
Stack: <!-- language, framework, ORM, auth, hosting -->
Schema owner: <!-- meavo-db / this repo / none -->
Key paths:
  - pages/routes:
  - server actions / API:
  - domain logic:
  - integrations:
  - tests:
Auth gate: <!-- function/middleware name -->
Cron jobs: <!-- paths + schedule if any -->
Sibling repos: <!-- what this borrows from -->
Do NOT list: <!-- 5-10 hard rules -->
Task → file map: <!-- at least 8 rows -->
```

**Task → file map** is the highest-value artifact. Build it from real directories and common tasks for this app.

### Phase C — Fill files (order matters)

| Order | File | Action |
|-------|------|--------|
| 1 | `AGENTS.md` | Replace all `<!-- FILL: ... -->` |
| 2 | `.cursor/rules/core.mdc` | Stack, layout, do-nots, `alwaysApply: true` |
| 3 | `.cursor/rules/domain.mdc` | Skip or delete if no domain layer; else set `globs` |
| 4 | `.cursor/rules/api.mdc` | Skip or delete if no API; else set `globs` |
| 5 | `docs/architecture.md` | Full stack + data flow |
| 6 | `docs/domain.md` | Skip if no business domain (e.g. pure utility lib) |
| 7 | `docs/data-model.md` | Skip if no persistence |
| 8 | `CONTRIBUTING.md` | Match team's actual PR process |
| 9 | `.cursorignore` | Match repo artifacts |
| 10 | `README.md` | Add docs table rows; fix broken agent links |

**Placeholder syntax:** replace entire `<!-- FILL: ... -->` blocks including the comment. Remove optional sections marked `<!-- OPTIONAL: ... -->` when not applicable.

**Legacy `.cursorrules`:** If present, merge unique content into `core.mdc`, then replace `.cursorrules` with:

```
# Cursor rules moved to .cursor/rules/
# See AGENTS.md and .cursor/rules/core.mdc
```

Or delete if fully superseded.

### Phase D — Quality bar

Before opening PR, verify:

- [ ] Every path in `AGENTS.md` task table exists on disk
- [ ] Every `Do NOT` is enforceable and true for this repo
- [ ] `npm run dev` / test / lint commands are copy-paste correct (from `package.json`)
- [ ] No `<!-- FILL:` placeholders remain (grep the repo)
- [ ] `docs/domain.md` mutation map names real modules
- [ ] Cursor rule `globs` match actual directories
- [ ] [CHECKLIST.md](CHECKLIST.md) passes

### Phase E — PR

- Branch: `docs/agent-instruction-files` or `cursor/agent-docs-bootstrap-f830`
- Title: `docs: add agent instruction files`
- Body: list files added/updated, note anything marked N/A or skipped, link to CHECKLIST

---

## Repo-type hints

| Repo type | Emphasize | Skip |
|-----------|-----------|------|
| Next.js App Router app | `core.mdc`, `domain.mdc`, `api.mdc`, all docs | — |
| Shared npm package (`@meavo/*`) | Export map, build/publish, consumer repos | `domain.md` if no business rules |
| meavo-db | `data-model.md` is primary; schema migration rules | UI/domain docs |
| Cron-only / worker | `api.mdc` → cron routes; architecture data flow | personas |
| Legacy reference tree | Separate glob rules under `legacy-*/` | Don't document as live app |

---

## Anti-patterns

- Copying meavo-rp sheet columns into a repo that doesn't use Rep.Parts26
- Listing `src/lib/domain/` in task table when this repo uses `src/services/`
- 300-line `AGENTS.md` duplicating `docs/architecture.md`
- Leaving `<!-- FILL: -->` in merged files
- Conflicting rules in both `.cursorrules` and `.cursor/rules/core.mdc`
