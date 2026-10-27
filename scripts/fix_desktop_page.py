#!/usr/bin/env python3
"""Fix the 3 known corruption spots in the ported desktop page component.

Corruption pattern: `[m` / `[h` sequences were dropped from the source at
three places (likely a paste/encode artifact in the previous session).
"""
import re
import sys

PATH = "/home/z/my-project/fixstage/desktop-page.tsx"
src = open(PATH, encoding="utf-8").read()

FIXES = [
    ("  const ega, setMega] = useState(false)",
     "  const [mega, setMega] = useState(false)"),
    ("closest('aref^=\"#\"]')", "closest('a[href^=\"#\"]')"),
    ("  }, ega, lang, burger])",
     "  }, [mega, lang, burger])"),
]

applied = 0
for old, new in FIXES:
    if old in src:
        src = src.replace(old, new)
        applied += 1
    elif new in src:
        applied += 1  # already fixed
    else:
        sys.exit(f"PATTERN NOT FOUND: {old!r}")

open(PATH, "w", encoding="utf-8").write(src)
print(f"applied {applied}/3 fixes")

# sanity: no leftover suspicious fragments
for pat in [r"\bega,", r"aref\^", r"\}, ega"]:
    m = re.search(pat, src)
    if m:
        sys.exit(f"LEFTOVER CORRUPTION: {pat}")
print("no leftover corruption fragments")
