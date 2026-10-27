"""One-time port: scope the user-provided desktop ui.html stylesheet under .dpg.

The app's landing.css shares many class names (.shell, .rv, .mega, ...) with this
stylesheet, so every selector is prefixed with the page wrapper class to prevent
global clashes. html/body rules map onto the .dpg wrapper instead.
"""
import re

SRC = '/tmp/desktop-ui.css'
OUT = '/home/z/my-project/src/styles/desktop.css'
WRAP = '.dpg'

css = open(SRC).read()
css = css.replace('"Plus Jakarta Sans"', 'var(--font-jakarta)')
css = css.replace('"Instrument Serif"', 'var(--font-instrument)')

def scope_selector(sel: str) -> str:
    sel = sel.strip()
    if not sel:
        return sel
    # map root-level element selectors onto the wrapper
    if sel == ':root':
        return WRAP
    if sel == 'body':
        return WRAP
    if sel == 'body::after':
        return WRAP + '::after'
    if sel in ('html',):
        return ''  # dropped, handled by JS smooth scroll
    if sel.startswith(':root['):
        return WRAP + sel[len(':root'):]
    if sel.startswith(':root:not('):
        return WRAP + sel[len(':root'):]
    if sel.startswith('*,'):
        return '.dpg,.dpg *,.dpg *::before,.dpg *::after'
    if sel == '*':
        return '.dpg *'
    # comma list: prefix each part
    parts = [p.strip() for p in sel.split(',')]
    out = []
    for p in parts:
        if p == ':root':
            out.append(WRAP)
        elif p == 'body':
            out.append(WRAP)
        elif p == 'body::after':
            out.append(WRAP + '::after')
        elif p == 'html':
            out.append('')
        elif p.startswith(':root'):
            out.append(WRAP + p[len(':root'):])
        else:
            out.append(WRAP + ' ' + p)
    return ','.join(x for x in out if x)

def scope_block(body: str) -> str:
    """Prefix every top-level `selector{decls}` inside body text (no nesting)."""
    res = []
    i = 0
    n = len(body)
    while i < n:
        j = body.find('{', i)
        if j == -1:
            break
        sel = body[i:j]
        # find matching close brace
        depth = 1
        k = j + 1
        while k < n and depth:
            if body[k] == '{':
                depth += 1
            elif body[k] == '}':
                depth -= 1
            k += 1
        decls = body[j + 1:k - 1]
        s = scope_selector(sel)
        if s:
            if decls.lstrip().startswith('@'):
                # nested @ (media inside media) - recurse
                decls = scope_block(decls)
            res.append(s + '{' + decls + '}')
        else:
            print('dropped rule:', sel.strip()[:60])
        i = k
    return '\n'.join(res)

def transform(text: str) -> str:
    res = []
    i = 0
    n = len(text)
    while i < n:
        # skip whitespace/comments between rules
        m = re.match(r'\s+', text[i:])
        if m:
            i += m.end()
            continue
        if text.startswith('/*', i):
            j = text.find('*/', i) + 2
            i = j
            continue
        j = text.find('{', i)
        if j == -1:
            break
        sel = text[i:j]
        depth = 1
        k = j + 1
        while k < n and depth:
            if text[k] == '{':
                depth += 1
            elif text[k] == '}':
                depth -= 1
            k += 1
        decls = text[j + 1:k - 1]
        stripped = sel.strip()
        if stripped.startswith('@keyframes'):
            res.append(stripped + '{' + decls + '}')
        elif stripped.startswith('@media'):
            inner = re.sub(r'^\s+|\s+$', '', decls)
            # media contains rules (and possibly nested media in original: not present)
            scoped = scope_block(inner)
            res.append(stripped + '{' + '\n' + scoped + '\n' + '}')
        elif stripped.startswith('@'):
            res.append(stripped + '{' + decls + '}')
        else:
            res.append(scope_block(sel + '{' + decls + '}'))
        i = k
    return '\n\n'.join(res)

out = transform(css)
header = (
    '/* Small Editor Desktop page. Ported 1:1 from the user-provided design file\n'
    '   (upload/desktop ui.html). Scoped under .dpg because landing.css shares\n'
    '   class names (.shell, .rv, .mega, ...). Fonts come from layout.tsx vars. */\n\n'
)
open(OUT, 'w').write(header + out + '\n')
print('written', OUT, len(out), 'bytes')
