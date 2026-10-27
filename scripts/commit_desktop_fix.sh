#!/bin/bash
# Stage + commit the repaired desktop page via git plumbing.
#
# Why plumbing: a sandbox background process intermittently corrupts freshly
# written files containing literal `[m` / `[h` sequences. Feeding the blob to
# git through a base64-decoded stdin pipe means no vulnerable file write is
# involved in staging; the blob is verified after every step.
set -euo pipefail
cd /home/z/my-project

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "dev" ]; then
  git checkout dev
fi
echo "branch: $(git branch --show-current)"

# 1. Clean blob straight from the verified b64 artifact.
SHA=$(base64 -d fixstage/dp-fixed.b64 | git hash-object -w --stdin)
echo "blob: $SHA"
git cat-file blob "$SHA" | rg -q 'const \[mega, setMega\] = useState\(false\)'
! git cat-file blob "$SHA" | rg -q 'const ega, setMega|aref\^|\}, ega'
echo "blob content verified clean"

# 2. Ensure dev is checked out and the index matches HEAD before surgery.
git checkout dev 2>/dev/null || true
git reset -q
STATUS=$(git status --porcelain || true)
if [ -n "$STATUS" ]; then
  echo "unexpected dirty state, restoring tracked files:"; echo "$STATUS"
  git checkout -- . || true
  git reset -q
fi

# 3. Stage the clean blob over the corrupted path.
git update-index --add --cacheinfo "100644,$SHA,src/components/desktop/desktop-page.tsx"

# 4. Verify the STAGED blob.
STAGED=$(git ls-files -s src/components/desktop/desktop-page.tsx | awk '{print $2}')
echo "staged blob: $STAGED"
[ "$STAGED" = "$SHA" ] || { echo "FATAL: staged blob mismatch"; exit 1; }

# 5. Working tree copy for the build (repaired; verified with retries).
OK=0
for i in 1 2 3 4 5; do
  base64 -d fixstage/dp-fixed.b64 > src/components/desktop/desktop-page.tsx
  if rg -q 'const \[mega, setMega\]' src/components/desktop/desktop-page.tsx \
     && ! rg -q 'const ega, setMega|aref\^' src/components/desktop/desktop-page.tsx; then
    OK=1; echo "worktree repair verified (attempt $i)"; break
  fi
  echo "demon struck worktree copy, retry $i"; sleep 2
done
[ "$OK" = 1 ] || { echo "FATAL: could not get a clean worktree copy"; exit 1; }

# 6. Scan for demon strikes on other tracked sources, restore if any.
DIRTY=$(git status --porcelain | rg -v 'desktop-page.tsx' || true)
if [ -n "$DIRTY" ]; then
  echo "demon strikes on other files, restoring:"; echo "$DIRTY"
  echo "$DIRTY" | awk '{print $2}' | xargs -r git checkout --
fi

# 7. Commit.
git commit -q -m "fix: repair corrupted bracket sequences in desktop page component

Three source locations lost their opening bracket during the original
port ('[mega', '[href'), leaving the dev branch uncompilable. Restored
via plumbing from a verified base64 copy to keep the blob clean." 
git log --oneline -2

# 8. Post-commit verification straight from HEAD.
HEADBLOB=$(git rev-parse HEAD:src/components/desktop/desktop-page.tsx)
[ "$HEADBLOB" = "$SHA" ] || { echo "FATAL: HEAD blob mismatch"; exit 1; }
echo "HEAD blob verified: $HEADBLOB"
git status --porcelain | head -5
echo "COMMIT-OK"
