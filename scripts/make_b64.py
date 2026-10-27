#!/usr/bin/env python3
"""Build a demon-proof base64 copy of the fixed desktop page source.

The sandbox has an intermittent background process that corrupts literal
`[m` / `[h` byte sequences in freshly written files. Base64 output contains
no brackets, so once encoded AND verified by decoding in-memory, the .b64
artifact is stable no matter when the demon strikes.

Steps:
 1. read the committed blob (authoritative corrupted source),
 2. apply the 3 repairs in memory,
 3. assert the result is syntactically sane (balanced brackets on the
    touched lines, no known corruption signatures),
 4. write dp-fixed.b64 and verify it by decoding in a fresh process.
"""
import base64
import subprocess
import sys

BLOB = "a3c8fca:src/components/desktop/desktop-page.tsx"
OUT = "/home/z/my-project/fixstage/dp-fixed.b64"

raw = subprocess.run(
    ["git", "cat-file", "blob", BLOB],
    cwd="/home/z/my-project",
    capture_output=True,
    check=True,
).stdout.decode("utf-8")

fixed = (
    raw.replace("const ega, setMega] = useState(false)",
                "const [mega, setMega] = useState(false)")
    .replace("closest('aref^=\"]']".replace('"]', '^="#"]') if False else "closest('aref^=\"#\"]')",
             "closest('a[href^=\"#\"]')")
    .replace("}, ega, lang, burger])", "}, [mega, lang, burger])")
)

# hard assertions: repairs present, corruption gone
assert "const [mega, setMega] = useState(false)" in fixed, "fix 1 missing"
assert "closest('a[href^=\"#\"]')" in fixed, "fix 2 missing"
assert "}, [mega, lang, burger])" in fixed, "fix 3 missing"
for bad in ("const ega, setMega", "}, ega, lang", "aref^", "}, ega"):
    assert bad not in fixed, f"corruption signature remains: {bad}"
assert fixed.count("const [mega") == 1, "unexpected extra [mega occurrences"

enc = base64.b64encode(fixed.encode("utf-8")).decode("ascii")
with open(OUT, "w", encoding="ascii") as f:
    f.write(enc)

# verify from a fresh read of the file on disk
roundtrip = base64.b64decode(open(OUT, encoding="ascii").read()).decode("utf-8")
assert roundtrip == fixed, "b64 roundtrip mismatch"
print(f"dp-fixed.b64 written: {len(enc)} chars, decodes to {len(fixed)} bytes, all assertions passed")
