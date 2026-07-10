# meavo-agent-templates

Org-wide template pack for **AI coding agent instruction files** in [meavo-booths](https://github.com/meavo-booths) repositories.

> **Location:** This folder is org-shared tooling — not part of the meavo-rp runtime. Preferred home is a dedicated repo: `github.com/meavo-booths/meavo-agent-templates`. An org admin can create that repo and move this directory there unchanged.

Use this pack to bootstrap or refresh agent docs in any Meavo project (Next.js apps, shared packages, cron workers, legacy GAS reference trees, etc.) without copying from a sibling app like `meavo-rp`.

## What's in the pack

| Path | Purpose |
|------|---------|
| [INSTRUCTIONS.md](INSTRUCTIONS.md) | **Start here** — human + agent workflow for adopting templates in a target repo |
| [BOOTSTRAP.md](BOOTSTRAP.md) | Agent-only playbook: discover repo → fill templates → verify |
| [CHECKLIST.md](CHECKLIST.md) | Post-bootstrap verification |
| [templates/](templates/) | Blank files with `<!-- FILL: ... -->` placeholders |
| [scripts/bootstrap-agent-docs.sh](scripts/bootstrap-agent-docs.sh) | Copies templates into a target repo (strips `.template` suffix) |

## Quick start (human)

```bash
# From your target repo root (e.g. meavo-sales, meavo-gateway)
curl -fsSL https://raw.githubusercontent.com/meavo-booths/meavo-agent-templates/main/scripts/bootstrap-agent-docs.sh | bash -s -- .

# Or clone this repo and run locally:
git clone https://github.com/meavo-booths/meavo-agent-templates.git
./meavo-agent-templates/scripts/bootstrap-agent-docs.sh /path/to/your-repo
```

Then open `AGENTS.md` and the `docs/` files and replace every `<!-- FILL: ... -->` block with repo-specific content. See [INSTRUCTIONS.md](INSTRUCTIONS.md) for the full workflow.

## Quick start (Cursor / Cloud Agent)

Paste into the agent:

```
Bootstrap agent instruction files for this repo using meavo-booths/meavo-agent-templates.
Follow BOOTSTRAP.md in that repo. Do not copy meavo-rp-specific content — discover this repo's stack, layout, and domain from the codebase.
```

## Design principles

1. **Task-oriented** — agents need “where to change X”, not essays.
2. **Layered** — `AGENTS.md` (short) → `docs/*` (deep) → `.cursor/rules/*` (enforced).
3. **Repo-specific** — templates are blanks; each app fills in its own stack, paths, and business rules.
4. **Single source of truth** — link between files; don't duplicate long sections.
5. **Minimal diff discipline** — encoded in `CONTRIBUTING.md` and cursor rules.

## Related Meavo conventions

- Database schema changes live in **[meavo-db](https://github.com/meavo-booths/meavo-db)** unless the repo is DB-only.
- Shared UI header: `@meavo/navigation` (Next.js apps).
- Auth pattern: NextAuth v5 + gateway `User` / `ToolCardAccess` (most internal apps).

These are hints for filling templates — not every repo uses all of them.

## Maintaining this pack

When you improve agent docs in one Meavo repo and the pattern is reusable:

1. Generalize the improvement into a template here (keep placeholders).
2. Open a PR to `meavo-agent-templates`.
3. Optionally refresh sibling repos in a follow-up PR.
