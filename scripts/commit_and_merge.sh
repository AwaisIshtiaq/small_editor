#!/bin/bash
# Commit the desktop.css relative-import fix on dev via plumbing (the
# wrapper content goes through a verified base64 pipe, not a vulnerable
# file write), then fast-forward main.
set -euo pipefail
cd /home/z/my-project

git checkout -f dev 2>/dev/null || git checkout dev
BR=$(git branch --show-current)
[ "$BR" = "dev" ] || { echo "FATAL: on $BR"; exit 1; }

# index must match dev's HEAD before the surgical update
git reset -q

SHA=$(base64 -d fixstage/wrapper.b64 | git hash-object -w --stdin)
echo "wrapper blob: $SHA"
git cat-file blob "$SHA" | rg -q "import '../../styles/desktop.css'"

git update-index --add --cacheinfo "100644,$SHA,src/app/desktop/page.tsx"
STAGED=$(git ls-files -s src/app/desktop/page.tsx | awk '{print $2}')
[ "$STAGED" = "$SHA" ] || { echo "FATAL: staged blob mismatch"; exit 1; }

git commit -q -m "fix: import desktop.css via relative path so Turbopack bundles it

The @/styles alias import compiled but the stylesheet never reached the
client chunks, so /desktop rendered unstyled. Relative import (same
pattern as landing.css on the home page) lands the rules in the chunk
graph. Verified: .dpg rules present in the served CSS and the page
renders styled end to end."

NEW=$(git rev-parse --short dev)
echo "dev is now: $NEW"
[ "$(git rev-parse dev:src/app/desktop/page.tsx)" = "$SHA" ] || { echo "FATAL: dev tree blob mismatch"; exit 1; }
git log --oneline -3

# fast-forward main
git checkout -f main 2>/dev/null || git checkout main
git merge --ff-only dev
[ "$(git rev-parse main)" = "$(git rev-parse dev)" ] && echo "main fast-forwarded to dev"
git log --oneline -2

# return to dev for future work
git checkout -f dev 2>/dev/null || true
echo "branch now: $(git branch --show-current)"
echo "MERGE-OK"
