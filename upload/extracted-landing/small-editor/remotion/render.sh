#!/usr/bin/env bash
# Renders both compositions to transparent PNG frames, then to looping animated WebP.
# Needs: npm install (once), ffmpeg. If Remotion cannot download Chrome, set BROWSER to a local Chrome/Chromium binary.
set -e
BROWSER_ARG=""; [ -n "$BROWSER" ] && BROWSER_ARG="--browser-executable=$BROWSER"
rm -rf out; mkdir -p out
for c in WebIll:web DesktopIll:desktop; do
  id=${c%%:*}; n=${c##*:}
  npx remotion render src/index.js "$id" "out/$n" --sequence --image-format=png $BROWSER_ARG
  ffmpeg -y -framerate 30 -i "out/$n/element-%02d.png" -vf "scale=300:-1:flags=lanczos" \
    -c:v libwebp_anim -lossless 0 -q:v 70 -loop 0 "out/$n.webp"
done
echo "Done: out/web.webp and out/desktop.webp"
