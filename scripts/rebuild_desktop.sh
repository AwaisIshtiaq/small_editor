#!/bin/bash
# Repair dev worktree, rebuild, verify CSS bundling. Retries around the
# sandbox's branch-flip demon, which intermittently checks out main and
# deletes dev-only directories.
cd /home/z/my-project

repair() {
  git checkout -f dev 2>/dev/null || git checkout dev
  mkdir -p src/components/desktop src/app/desktop src/styles
  base64 -d fixstage/dp-fixed.b64 > src/components/desktop/desktop-page.tsx
  base64 -d fixstage/wrapper.b64 > src/app/desktop/page.tsx
  base64 -d fixstage/b64/desktop-data.ts.b64 > src/components/desktop/desktop-data.ts
  base64 -d fixstage/b64/desktop.css.b64 > src/styles/desktop.css
  local ok=1
  rg -q "import '../../styles/desktop.css'" src/app/desktop/page.tsx || ok=0
  rg -q 'const \[mega, setMega\]' src/components/desktop/desktop-page.tsx || ok=0
  rg -q '\.dpg\{' src/styles/desktop.css || ok=0
  rg -q 'Alternate & Mix' src/components/desktop/desktop-data.ts || ok=0
  if [ $ok = 1 ]; then echo "repair verified"; return 0; fi
  echo "repair struck, retrying"; return 1
}

for i in 1 2 3 4 5; do
  if repair; then break; fi
  [ $i = 5 ] && { echo "FATAL: could not stabilize worktree"; exit 1; }
  sleep 2
done

BR=$(git branch --show-current)
[ "$BR" = "dev" ] || { echo "FATAL: on $BR"; exit 1; }

echo "=== building ==="
if ! npm run build 2>&1 | tail -4; then
  echo "build failed, one repair+retry"
  repair || true
  npm run build 2>&1 | tail -4 || { echo "FATAL: build failed twice"; exit 1; }
fi

echo "=== verify .dpg css in build output ==="
if rg -l '\.dpg' .next/static/chunks/*.css >/dev/null 2>&1; then
  rg -l '\.dpg' .next/static/chunks/*.css
else
  echo "FATAL: .dpg rules still not bundled"; exit 1
fi
echo "BUILD-OK"
