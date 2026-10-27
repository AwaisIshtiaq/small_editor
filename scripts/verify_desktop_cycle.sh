#!/bin/bash
# One atomic verification cycle: repair sources -> build -> verify every
# client chunk parses -> serve -> screenshot. If the sandbox corruption
# demon strikes any .next output, the chunk check fails and we retry the
# whole cycle (build hashes change each time).
cd /home/z/my-project

repair() {
  git checkout -f dev 2>/dev/null || git checkout dev
  mkdir -p src/components/desktop src/app/desktop src/styles
  base64 -d fixstage/dp-fixed.b64 > src/components/desktop/desktop-page.tsx
  base64 -d fixstage/wrapper.b64 > src/app/desktop/page.tsx
  base64 -d fixstage/b64/desktop-data.ts.b64 > src/components/desktop/desktop-data.ts
  base64 -d fixstage/b64/desktop.css.b64 > src/styles/desktop.css
  rg -q "import '../../styles/desktop.css'" src/app/desktop/page.tsx || return 1
  rg -q 'const \[mega, setMega\]' src/components/desktop/desktop-page.tsx || return 1
  return 0
}

chunks_ok() {
  local H u f bad=0
  H=$(curl -s http://localhost:3005/desktop)
  [ -n "$H" ] || return 1
  echo "$H" | rg -q 'class="dpg"' || { echo "HTML missing .dpg (stale build served)"; return 1; }
  mkdir -p fixstage/chunks && rm -f fixstage/chunks/*.js
  for u in $(echo "$H" | rg -o 'src="/_next/static/chunks/[^"]*\.js"' | sed 's/src="//;s/"//'); do
    f="fixstage/chunks/$(basename "$u")"
    curl -s "http://localhost:3005$u" -o "$f"
    if ! node --check "$f" 2>/dev/null; then
      echo "BAD chunk: $(basename "$u")"
      bad=1
    fi
  done
  [ $bad = 0 ] && echo "all chunks parse OK" || return 1
  return 0
}

pkill -f "next start" 2>/dev/null; pkill -f "next-server" 2>/dev/null; sleep 1

for i in 1 2 3; do
  echo "=== cycle $i ==="
  repair || { echo "repair failed"; sleep 2; continue; }
  npm run build > /tmp/build.log 2>&1 || { echo "build failed"; tail -5 /tmp/build.log; sleep 2; continue; }
  rg -lq '\.dpg' .next/static/chunks/*.css || { echo "css missing"; sleep 2; continue; }
  (PORT=3005 npm start > /tmp/server.log 2>&1 &)
  sleep 6
  if chunks_ok; then
    agent-browser open http://localhost:3005/desktop 2>&1 | tail -1
    sleep 3
    agent-browser screenshot fixstage/desktop-shot3.png 2>&1 | tail -1
    pkill -f "next start" 2>/dev/null; pkill -f "next-server" 2>/dev/null
    echo "CYCLE-OK"
    exit 0
  fi
  pkill -f "next start" 2>/dev/null; pkill -f "next-server" 2>/dev/null
  sleep 2
done
echo "FATAL: no clean cycle in 3 attempts"
exit 1
