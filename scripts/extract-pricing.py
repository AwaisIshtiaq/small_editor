"""Extract embedded base64 images from the pricing design HTML and emit a clean copy."""
import base64, re, os

SRC = "/home/z/my-project/upload/Pricing — Small Editor.html"
OUT_DIR = "/home/z/my-project/public/pricing"
CLEAN = "/home/z/my-project/upload/pricing-clean.html"

os.makedirs(OUT_DIR, exist_ok=True)
html = open(SRC, encoding="utf-8").read()

names = ["week", "monthly", "annual", "free"]
idx = 0

def repl(m):
    global idx
    name = names[idx] if idx < len(names) else f"img{idx}"
    idx += 1
    path = f"/pricing/{name}.webp"
    with open(os.path.join(OUT_DIR, f"{name}.webp"), "wb") as f:
        f.write(base64.b64decode(m.group(1)))
    return f'src="{path}"'

clean = re.sub(r'src="data:image/webp;base64,([A-Za-z0-9+/=]+)"', repl, html)
open(CLEAN, "w", encoding="utf-8").write(clean)
print(f"extracted {idx} images -> {OUT_DIR}")
print(f"clean html written -> {CLEAN} ({len(clean)} chars)")
for n in names[:idx]:
    p = os.path.join(OUT_DIR, f"{n}.webp")
    print(n, os.path.getsize(p), "bytes")
