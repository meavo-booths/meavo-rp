# Instructions — adopting agent docs in a Meavo repo

Use this guide when adding or refreshing instruction files in any **meavo-booths** repository.

## Who does what

| Role | Action |
|------|--------|
| **Human (repo owner)** | Run bootstrap, review filled docs, merge PR |
| **AI agent** | Follow [BOOTSTRAP.md](BOOTSTRAP.md) — discover repo, fill placeholders, open PR |
| **Org maintainer** | Keep templates in `meavo-agent-templates` generic and up to date |

## Step 1 — Bootstrap file skeleton

From the **target repo root**:

```bash
# Option A: clone + script
git clone https://github.com/meavo-booths/meavo-agent-templates.git /tmp/meavo-agent-templates
/tmp/meavo-agent-templates/scripts/bootstrap-agent-docs.sh .

# Option B: one-liner (after this repo is published)
curl -fsSL https://raw.githubusercontent.com/meavo-booths/meavo-agent-templates/main/scripts/bootstrap-agent-docs.sh | bash -s -- .
```

The script copies:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `.cursorignore`
- `.cursor/rules/core.mdc`, `domain.mdc`, `api.mdc`
- `docs/architecture.md`, `domain.md`, `data-model.md` (skip `data-model.md` if no database)

**It will not overwrite** existing files unless you pass `--force`.

## Step 2 — Discover the repo (before writing prose)

Agents and humans should read the codebase first. Minimum discovery:

| Question | Where to look |
|----------|----------------|
| Stack & runtime | `package.json`, `pyproject.toml`, `go.mod`, `Dockerfile`, `vercel.json` |
| Folder layout | `src/`, `app/`, `lib/`, `packages/` |
| Entry points | `README.md`, main `page.tsx` / `index.ts` |
| Auth | `auth.ts`, `middleware.ts`, env vars in `.env.example` |
| Database | `prisma`, `@meavo/db`, `drizzle`, or none |
| External integrations | `integrations/`, `api/`, cron routes |
| Tests & lint | `package.json` scripts, `eslint.config.*`, `vitest.config.*` |
| Legacy / parity | `legacy-*`, comments referencing old systems |

Take notes — you'll paste findings into template placeholders.

## Step 3 — Fill templates (priority order)

Work top-down. Stop when a section doesn't apply and mark it `N/A` or delete it.

### 3.1 `AGENTS.md` (required)

Keep under **~150 lines**. Must include:

- One-sentence product description
- Stack bullets
- **Task → file** table (most valuable section)
- 5–10 **Do NOT** rules
- Dev commands (`install`, `dev`, `test`, `lint`, `build`)
- Links to `docs/` and `.cursor/rules/`

### 3.2 `.cursor/rules/core.mdc` (required)

`alwaysApply: true` — stack, layout table, hard guardrails, data-flow one-liner.

Migrate any legacy root `.cursorrules` content here, then **delete or slim** `.cursorrules` to avoid duplicate/conflicting rules. Point `.cursorrules` at `.cursor/rules/` with one line if your team still expects the file.

### 3.3 `.cursor/rules/domain.mdc` (if `lib/domain/` or equivalent exists)

Glob-scoped rules for business logic: thin handlers, mutation patterns, side effects (sheet sync, webhooks, etc.).

### 3.4 `.cursor/rules/api.mdc` (if HTTP API / Server Actions / routes exist)

Glob-scoped: auth on every route, cron secret, validation, error shape.

### 3.5 `docs/architecture.md` (recommended for non-trivial apps)

Stack, sibling repos, folder map, data flow diagram, cron/job list, env vars overview.

### 3.6 `docs/domain.md` (recommended when business rules exist)

Glossary, roles/permissions, status values, mutation map, legacy port index.

### 3.7 `docs/data-model.md` (database repos only)

Schema ownership (usually **meavo-db**), entity diagram, field notes agents can't infer.

### 3.8 `CONTRIBUTING.md` (recommended)

Branch naming, PR checklist, test expectations, cross-repo bump process.

### 3.9 `.cursorignore` (recommended)

Tune for the repo — exclude build dirs, `node_modules`, generated code, large fixtures.

## Step 4 — Wire up entry points

Update the target repo's `README.md` documentation table:

```markdown
| [AGENTS.md](AGENTS.md) | Quick orientation for AI coding agents |
| [.cursor/rules/](.cursor/rules/) | Always-on Cursor rules |
| [docs/architecture.md](docs/architecture.md) | Stack and data flow |
```

Remove stale references (e.g. pointing at `.mdc` files that don't exist).

## Step 5 — Verify

Run through [CHECKLIST.md](CHECKLIST.md). Open a PR titled e.g. `docs: add agent instruction files`.

## Step 6 — Keep docs alive

Update agent docs in the **same PR** when you:

- Add a new top-level area (`src/lib/integrations/foo/`)
- Change auth, schema ownership, or deployment constraints
- Introduce a new persona, status, or cron job

Stale `AGENTS.md` is worse than none — agents will trust wrong paths.

## Optional: legacy / sub-project rules

If the repo contains a **read-only legacy subtree** (e.g. `legacy-gas/`):

- Add `legacy-gas/.cursorrules` or `.cursor/rules/legacy.mdc` with a glob for that path only
- State clearly: **not the live deployment target**

## Optional: monorepo packages

For repos with `packages/*`:

- One `AGENTS.md` at repo root with a package index table
- Optional per-package `packages/foo/AGENTS.md` for package-specific tasks (keep short)
- Cursor rules: `core.mdc` at root; add `packages/foo/.cursor/rules/` only when conventions differ

## Getting help from an agent

Use this prompt in the target repo:

```
Read meavo-booths/meavo-agent-templates BOOTSTRAP.md and bootstrap agent docs for THIS repo.
Discover stack and layout from the codebase. Fill all <!-- FILL: --> placeholders.
Do not copy content from other Meavo repos verbatim. Open a PR when done.
Use CHECKLIST.md to verify.
```
