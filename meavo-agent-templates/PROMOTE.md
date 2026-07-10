# Promote to standalone org repo

The GitHub integration token cannot create new org repositories. After merge, an org admin can:

```bash
# 1. Create empty repo in GitHub UI: meavo-booths/meavo-agent-templates

# 2. From this directory (or a fresh clone of meavo-rp/meavo-agent-templates)
cd meavo-agent-templates
git init -b main
git add -A
git commit -m "Initial agent documentation template pack"
git remote add origin https://github.com/meavo-booths/meavo-agent-templates.git
git push -u origin main

# 3. Optionally remove this folder from meavo-rp in a follow-up PR
```

Until then, other repos can bootstrap via:

```bash
git clone https://github.com/meavo-booths/meavo-rp.git /tmp/meavo-rp
/tmp/meavo-rp/meavo-agent-templates/scripts/bootstrap-agent-docs.sh /path/to/target-repo
```

Or copy `meavo-agent-templates/` from any meavo-booths checkout that includes it.
