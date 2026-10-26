import csv
import hashlib
from pathlib import Path

ROOT = Path('D:/small_editor')
OUT = ROOT / 'reports/evidence'
OUT.mkdir(parents=True, exist_ok=True)


def row(path, kind, workflow='', tool_route='', source='', description=''):
    p = Path(path)
    if not p.is_absolute():
        p = ROOT / p
    if not p.exists():
        raise FileNotFoundError(p)
    b = p.read_bytes()
    h = hashlib.sha256(b).hexdigest()
    rel = p.relative_to(ROOT).as_posix()
    return {
        'artifact_id': f'art_{h}',
        'path': rel,
        'bytes': len(b),
        'sha256': h,
        'kind': kind,
        'workflow': workflow,
        'tool_route': tool_route,
        'source': source,
        'description': description,
    }


tools = list(csv.DictReader((ROOT / 'reports/coverage/tools.csv').open(encoding='utf-8')))
static_rows = []
for t in tools:
    route = t['route']
    slug = route.strip('/').replace('/', '_') or 'home'
    source = t['capture_source']
    base = 'reports/_raw/static-pass/bundle-pages' if source == 'rea-bundle' else 'reports/_raw/static-pass/pages'
    for ext, kind, desc in [
        ('html', 'html', 'sanitized page DOM'),
        ('png', 'screenshot', '1440x900 screenshot'),
        ('json', 'json', 'parsed page inventory'),
    ]:
        p = f'{base}/{slug}.{ext}'
        static_rows.append(row(p, kind, workflow='tool-page-matrix', tool_route=route, source=source, description=desc))

static_rows += [
    row('reports/_raw/rea-static-pages.mjs', 'script', workflow='tool-page-matrix', source='static-cdp', description='35-page CDP capture script'),
    row('reports/_raw/extract-bundle-pages.mjs', 'script', workflow='tool-page-matrix', source='rea-bundle', description='bundle DOM extraction and parsing script'),
    row('reports/_raw/build-coverage.py', 'script', workflow='tool-page-matrix', source='analysis', description='authoritative CSV builder'),
    row('reports/_raw/static-pass/summary.json', 'summary', workflow='tool-page-matrix', source='static-cdp', description='35-page capture summary'),
    row('reports/_raw/static-pass/bundle-pages/summary.json', 'summary', workflow='tool-page-matrix', source='rea-bundle', description='9-page bundle extraction summary'),
    row('reports/coverage/tools.csv', 'csv', workflow='tool-page-matrix', source='analysis', description='44-tool authoritative matrix'),
    row('reports/coverage/routes.csv', 'csv', workflow='tool-page-matrix', source='analysis', description='55-route English inventory'),
    row('reports/coverage/locales.csv', 'csv', workflow='tool-page-matrix', source='analysis', description='29-row locale inventory'),
    row('reports/coverage/coverage.csv', 'csv', workflow='tool-page-matrix', source='analysis', description='coverage metrics'),
    row('reports/coverage/coverage-build.json', 'json', workflow='tool-page-matrix', source='analysis', description='coverage counts'),
]

with (OUT / 'static-tool-matrix-manifest.csv').open('w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(static_rows[0].keys()), lineterminator='\n')
    w.writeheader()
    w.writerows(static_rows)

workflow_files = [
    ('samples/sample.pdf', 'fixture', 'shared', '4-page 2,924-byte fixture'),
    ('samples/sample-merge-b.pdf', 'fixture', 'merge', 'identical second copy for merge/alternate-mix'),
    ('samples/sample-bookmarks.pdf', 'fixture', 'splitByBookmarks', '4-page fixture with level-1 and level-2 outline entries'),
    ('reports/_raw/rea-upload-task-network.json', 'json', 'splitByPages', 'prior raw split task trace'),
    ('reports/_raw/rea-upload-task-network.sanitized.json', 'json', 'splitByPages', 'prior sanitized split task trace'),
    ('reports/_raw/rea-split-result.zip', 'zip', 'splitByPages', 'prior split result ZIP'),
    ('reports/_raw/merge-upload-probe.mjs', 'script', 'merge', 'upload-only probe script (run timed out after upload; task trace records the ready state)'),
    ('reports/_raw/merge-submit-probe.mjs', 'script', 'merge', 'task submit/download probe'),
    ('reports/_raw/merge-task-network.json', 'json', 'merge', 'raw merge task trace'),
    ('reports/_raw/merge-task-network.sanitized.json', 'json', 'merge', 'sanitized merge task trace'),
    ('reports/_raw/merge-result.pdf', 'pdf', 'merge', '8-page merged output'),
    ('reports/_raw/merge-result.png', 'screenshot', 'merge', 'result modal'),
    ('reports/_raw/workflow-probe.mjs', 'script', 'shared', 'upload-only workflow probe'),
    ('reports/_raw/workflow-submit.mjs', 'script', 'shared', 'generic task submit/download probe'),
    ('reports/_raw/header-footer-pdf-probe.json', 'json', 'headerFooter', 'upload-only probe'),
    ('reports/_raw/header-footer-pdf-probe.png', 'screenshot', 'headerFooter', 'task form ready'),
    ('reports/_raw/header-footer-pdf-task-network.json', 'json', 'headerFooter', 'raw header/footer task trace'),
    ('reports/_raw/header-footer-pdf-task-network.sanitized.json', 'json', 'headerFooter', 'sanitized header/footer task trace'),
    ('reports/_raw/header-footer-pdf-result.pdf', 'pdf', 'headerFooter', '4-page header/footer output'),
    ('reports/_raw/header-footer-pdf-result.png', 'screenshot', 'headerFooter', 'result modal'),
    ('reports/_raw/header-footer-pdf-result.html', 'html', 'headerFooter', 'sanitized result page DOM'),
    ('reports/_raw/pdf-to-jpg-probe.json', 'json', 'pdfToImage', 'upload-only probe'),
    ('reports/_raw/pdf-to-jpg-probe.png', 'screenshot', 'pdfToImage', 'page thumbnails and options'),
    ('reports/_raw/pdf-to-jpg-task-network.json', 'json', 'pdfToImage', 'raw conversion task trace with corrected download metadata'),
    ('reports/_raw/pdf-to-jpg-task-network.sanitized.json', 'json', 'pdfToImage', 'sanitized conversion task trace'),
    ('reports/_raw/pdf-to-jpg-result.zip', 'zip', 'pdfToImage', '4 JPG output ZIP'),
    ('reports/_raw/pdf-to-jpg-result.png', 'screenshot', 'pdfToImage', 'result modal'),
    ('reports/_raw/pdf-to-jpg-result.html', 'html', 'pdfToImage', 'sanitized result page DOM'),
    ('reports/_raw/fix-pdf-to-jpg-download.mjs', 'script', 'pdfToImage', 'correct-filename download retry'),
    ('reports/_raw/workflow-run.mjs', 'script', 'shared', 'parameterized upload, task submit and download runner'),
    ('reports/_raw/split-pdf-by-outline-task-network.json', 'json', 'splitByBookmarks', 'raw split-by-outline task trace'),
    ('reports/_raw/split-pdf-by-outline-task-network.sanitized.json', 'json', 'splitByBookmarks', 'sanitized split-by-outline task trace'),
    ('reports/_raw/split-pdf-by-outline-result.zip', 'zip', 'splitByBookmarks', '3-section split result ZIP'),
    ('reports/_raw/split-pdf-by-outline-result.png', 'screenshot', 'splitByBookmarks', 'result modal'),
    ('reports/_raw/split-pdf-by-outline-result.html', 'html', 'splitByBookmarks', 'sanitized result page DOM'),
    ('reports/_raw/split-outline-files/1_Chapter 1.pdf', 'pdf', 'splitByBookmarks', 'section 1: page 1'),
    ('reports/_raw/split-outline-files/2_Chapter 2.pdf', 'pdf', 'splitByBookmarks', 'section 2: pages 2-3'),
    ('reports/_raw/split-outline-files/3_Chapter 3.pdf', 'pdf', 'splitByBookmarks', 'section 3: page 4'),
    ('reports/_raw/alternate-mix-pdf-task-network.json', 'json', 'alternateMix', 'raw alternate-mix task trace'),
    ('reports/_raw/alternate-mix-pdf-task-network.sanitized.json', 'json', 'alternateMix', 'sanitized alternate-mix task trace'),
    ('reports/_raw/alternate-mix-pdf-result.pdf', 'pdf', 'alternateMix', '8-page interleaved output'),
    ('reports/_raw/alternate-mix-pdf-result.png', 'screenshot', 'alternateMix', 'result modal'),
    ('reports/_raw/alternate-mix-pdf-result.html', 'html', 'alternateMix', 'sanitized result page DOM'),
    ('reports/_raw/encrypt-pdf-task-network.json', 'json', 'encrypt', 'raw AES-256 encryption task trace'),
    ('reports/_raw/encrypt-pdf-task-network.sanitized.json', 'json', 'encrypt', 'sanitized encryption task trace'),
    ('reports/_raw/encrypt-pdf-result.pdf', 'pdf', 'encrypt', '4-page AES-256 encrypted output'),
    ('reports/_raw/encrypt-pdf-result.png', 'screenshot', 'encrypt', 'result modal'),
    ('reports/_raw/encrypt-pdf-result.html', 'html', 'encrypt', 'sanitized result page DOM'),
    ('reports/_raw/verify-followup-workflows.mjs', 'script', 'shared', 'independent page-count, order, password and rate-limit checks'),
    ('reports/_raw/followup-workflow-verification.json', 'json', 'shared', 'verification summary for the three follow-up tasks'),
    ('reports/_raw/phase4c-task-run.mjs', 'script', 'shared', 'phase 4C parameterized task runner with form controls and page rotations'),
    ('reports/_raw/split-pdf-by-size-task-network.json', 'json', 'splitBySize', 'raw split-by-size task trace'),
    ('reports/_raw/split-pdf-by-size-task-network.sanitized.json', 'json', 'splitBySize', 'sanitized split-by-size task trace'),
    ('reports/_raw/split-pdf-by-size-result.zip', 'zip', 'splitBySize', 'four one-page PDFs in a ZIP'),
    ('reports/_raw/split-pdf-by-size-result.png', 'screenshot', 'splitBySize', 'result modal'),
    ('reports/_raw/split-pdf-by-size-result.html', 'html', 'splitBySize', 'sanitized result page DOM'),
    ('reports/_raw/extract-pdf-pages-task-network.json', 'json', 'extractPages', 'raw extract-pages task trace'),
    ('reports/_raw/extract-pdf-pages-task-network.sanitized.json', 'json', 'extractPages', 'sanitized extract-pages task trace'),
    ('reports/_raw/extract-pdf-pages-result.pdf', 'pdf', 'extractPages', '3-page extracted PDF (source pages 1, 3, 4)'),
    ('reports/_raw/extract-pdf-pages-result.png', 'screenshot', 'extractPages', 'result modal'),
    ('reports/_raw/extract-pdf-pages-result.html', 'html', 'extractPages', 'sanitized result page DOM'),
    ('reports/_raw/rotate-pdf-pages-task-network.json', 'json', 'rotatePages', 'raw rotate-pages task trace'),
    ('reports/_raw/rotate-pdf-pages-task-network.sanitized.json', 'json', 'rotatePages', 'sanitized rotate-pages task trace'),
    ('reports/_raw/rotate-pdf-pages-result.pdf', 'pdf', 'rotatePages', '4-page rotated PDF (90, 0, 180, 270)'),
    ('reports/_raw/rotate-pdf-pages-result.png', 'screenshot', 'rotatePages', 'result modal'),
    ('reports/_raw/rotate-pdf-pages-result.html', 'html', 'rotatePages', 'sanitized result page DOM'),
    ('reports/_raw/verify-phase4c-workflows.mjs', 'script', 'shared', 'independent ZIP, page-count, page-order, rotation and rate-limit checks'),
    ('reports/_raw/phase4c-workflow-verification.json', 'json', 'shared', 'verification summary for the three phase 4C tasks'),
    ('reports/07-api-contracts.yaml', 'yaml', 'shared', 'reconstructed OpenAPI contract v0.5.0'),
    ('site-re/sites/sejda-com/claims.csv', 'csv', 'shared', 'evidence claims ledger'),
    ('reports/coverage/tools.csv', 'csv', 'shared', 'tool matrix'),
    ('reports/coverage/coverage.csv', 'csv', 'shared', 'coverage metrics'),
    ('reports/coverage/coverage-build.json', 'json', 'shared', 'coverage counts'),
    ('reports/22-tool-matrix-and-workflows.md', 'markdown', 'shared', 'tool matrix, workflow results and remaining gaps'),
]
workflow_rows = [
    row(path, kind, workflow=workflow, source='workflow-pass', description=desc)
    for path, kind, workflow, desc in workflow_files
]
with (OUT / 'workflow-pass-manifest.csv').open('w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(workflow_rows[0].keys()), lineterminator='\n')
    w.writeheader()
    w.writerows(workflow_rows)

print({'static_rows': len(static_rows), 'static_unique_hashes': len({r['sha256'] for r in static_rows}),
       'workflow_rows': len(workflow_rows), 'workflow_unique_hashes': len({r['sha256'] for r in workflow_rows})})
