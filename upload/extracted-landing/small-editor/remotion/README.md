# Remotion illustrations

Two transparent, seamless 3-second loops (90 frames at 30 fps, 400x340) used on the
"Works the way you work" cards.

- `src/WebIll.jsx` – floating cloud, server rack with blinking LEDs, rising data packets
- `src/DesktopIll.jsx` – monitor drawing text lines, highlight sweep, check pop (spring), swaying plant
- `src/Root.jsx` – registers both compositions

Colours live at the top of each file (`V` outline, `A` accent, plus the rgba fills).

## Commands
```
npm install
npm run studio          # live preview
./render.sh             # frames -> animated WebP in out/
```
Then base64-embed `out/web.webp` and `out/desktop.webp` as the `src` of the two
`<img class="ill">` tags in `../index.html` (`data:image/webp;base64,...`).
