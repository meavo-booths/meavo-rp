#!/usr/bin/env bash
# Bootstrap agent instruction files from meavo-agent-templates into a target repo.
# Usage: bootstrap-agent-docs.sh <target-repo-root> [--force] [--no-data-model]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATES="$TEMPLATE_ROOT/templates"

usage() {
  echo "Usage: $0 <target-repo-root> [--force] [--no-data-model]"
  echo ""
  echo "  --force          Overwrite existing agent doc files"
  echo "  --no-data-model  Skip docs/data-model.md (non-DB repos)
  --with-legacy    Also copy legacy.mdc (off by default — opt in via manual copy)"
  exit 1
}

[[ $# -lt 1 ]] && usage

TARGET="$(cd "$1" && pwd)"
shift

FORCE=0
NO_DATA_MODEL=0
WITH_LEGACY=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --no-data-model) NO_DATA_MODEL=1 ;;
    --with-legacy) WITH_LEGACY=1 ;;
    *) echo "Unknown option: $arg"; usage ;;
  esac
done

copy_template() {
  local src_rel="$1"
  local dest_rel="$2"
  local src="$TEMPLATES/$src_rel"
  local dest="$TARGET/$dest_rel"

  if [[ ! -f "$src" ]]; then
    echo "skip (missing template): $src_rel"
    return
  fi

  if [[ -f "$dest" && "$FORCE" -ne 1 ]]; then
    echo "skip (exists): $dest_rel  (use --force to overwrite)"
    return
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "wrote: $dest_rel"
}

echo "Bootstrapping agent docs into: $TARGET"
echo "Templates from: $TEMPLATES"
echo ""

copy_template "AGENTS.md.template" "AGENTS.md"
copy_template "CONTRIBUTING.md.template" "CONTRIBUTING.md"
copy_template ".cursorignore.template" ".cursorignore"
copy_template ".cursor/rules/core.mdc.template" ".cursor/rules/core.mdc"
copy_template ".cursor/rules/domain.mdc.template" ".cursor/rules/domain.mdc"
copy_template ".cursor/rules/api.mdc.template" ".cursor/rules/api.mdc"
if [[ "$WITH_LEGACY" -eq 1 ]]; then
  copy_template ".cursor/rules/legacy.mdc.template" ".cursor/rules/legacy.mdc"
fi
copy_template "docs/architecture.md.template" "docs/architecture.md"
copy_template "docs/domain.md.template" "docs/domain.md"

if [[ "$NO_DATA_MODEL" -eq 0 ]]; then
  copy_template "docs/data-model.md.template" "docs/data-model.md"
fi

echo ""
echo "Done. Next steps:"
echo "  1. Replace all <!-- FILL: ... --> placeholders (see INSTRUCTIONS.md)"
echo "  2. Delete or skip sections that don't apply"
echo "  3. Update README.md documentation links"
echo "  4. Run CHECKLIST.md before merging"
