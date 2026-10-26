import csv
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path('D:/small_editor')
SITE = ROOT / 'site-re/sites/sejda-com'
RAW = SITE / 'raw'
STATIC = ROOT / 'reports/_raw/static-pass'
OUT = ROOT / 'reports/coverage'
OUT.mkdir(parents=True, exist_ok=True)

INVENTORY = (SITE / 'inventory.md').read_text(encoding='utf-8')
SITEMAP = (RAW / 'sitemap.xml').read_text(encoding='utf-8')
HOME = (RAW / 'home.real.html').read_text(encoding='utf-8')

# 44 tools from the rendered All Tools inventory.
tools = []
for line in INVENTORY.splitlines():
    m = re.match(
        r'\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*`\./([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|',
        line,
    )
    if m:
        tools.append({
            'tool_id': int(m.group(1)),
            'tool_name': m.group(2).strip(),
            'route': '/' + m.group(3).strip(),
            'group': m.group(4).strip(),
            'description': m.group(5).strip(),
        })
assert len(tools) == 44, f'expected 44 tools, got {len(tools)}'
tool_routes = {t['route'] for t in tools}
assert len(tool_routes) == 44

# Sitemap and locale map.
locs = re.findall(r'<loc>(.*?)</loc>', SITEMAP)
paths = sorted({urlparse(u).path for u in locs})
hreflangs = {}
for m in re.finditer(r'<link[^>]+hreflang="([^"]+)"[^>]*href="([^"]+)"', HOME):
    hreflangs[m.group(1)] = urlparse(m.group(2)).path

locale_prefixes = []
for hreflang, path in hreflangs.items():
    if hreflang in ('en', 'x-default'):
        continue
    prefix = path.strip('/').split('/')[0]
    if prefix:
        locale_prefixes.append(prefix)
locale_prefixes = sorted(set(locale_prefixes))
assert len(locale_prefixes) == 28, f'expected 28 locales, got {len(locale_prefixes)}'

def is_english(path):
    first = path.strip('/').split('/')[0]
    return first not in locale_prefixes

english_paths = sorted(p for p in paths if is_english(p))
assert len(english_paths) == 52, f'expected 52 English sitemap paths, got {len(english_paths)}'

non_tool_sitemap = sorted(set(english_paths) - tool_routes)
menu_only_tools = sorted(tool_routes - set(english_paths))
assert len(non_tool_sitemap) == 10
assert len(menu_only_tools) == 2

# Known extra English route linked from the header but absent from the sitemap.
extra_routes = {'/account'}

# Page captures from the two passes.
static_summary = json.loads((STATIC / 'summary.json').read_text(encoding='utf-8'))
bundle_summary = json.loads((STATIC / 'bundle-pages/summary.json').read_text(encoding='utf-8'))
static_by_route = {r['route']: r for r in static_summary['results']}
bundle_by_route = {r['route'].lstrip('/'): r for r in bundle_summary['routes']}

def slug(route):
    return route.strip('/').replace('/', '_') or 'home'

def page_data(route):
    key = route.strip('/')
    if key in static_by_route:
        path = STATIC / 'pages' / f'{slug(route)}.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        return data, static_by_route[key], 'static-cdp', path
    if key in bundle_by_route:
        path = STATIC / 'bundle-pages' / f'{slug(route)}.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        return data, bundle_by_route[key], 'rea-bundle', path
    return None, None, None, None

def primary_file_inputs(file_inputs):
    non_contact = [
        f for f in (file_inputs or [])
        if f.get('formId') != 'contactForm' and f.get('id') != 'supportScreenshotFile'
    ]
    upload_form = [f for f in non_contact if f.get('formId') == 'fileUploadForm']
    rest = [f for f in non_contact if f.get('formId') != 'fileUploadForm']
    return upload_form + rest

def submit_label(data, route):
    curated = {
        '/split-pdf': 'Split PDF by pages',
        '/merge-pdf': 'Merge PDF files',
        '/split-pdf-by-outline': 'Split by bookmarks',
        '/split-pdf-by-size': 'Split PDF by size',
        '/alternate-mix-pdf': 'Mix PDF files',
        '/extract-pdf-pages': 'Extract pages',
        '/header-footer-pdf': 'Add header/footer',
        '/rotate-pdf-pages': 'Apply changes',
        '/pdf-to-jpg': 'Convert',
    }
    if route in curated:
        return curated[route], 'rea-bounded-pass-report'
    generic = {
        'Continue', 'Send message', 'No', 'Yes', 'Cancel', 'Close',
        'Upgrade', 'Log in', 'Toggle Dropdown', 'Next', 'More options',
        'Pages view', 'Files view', 'Sort by', 'Learn more', 'Move page',
        'Reload page', 'This does not answer my question', 'No, cancel',
        'Yes, continue', 'Ok, retry upload', 'Re-upload files',
        'Create New', 'Export', 'Import', 'Launch',
    }
    candidates = []
    for s in data.get('submits', []):
        text = (s.get('text') or '').strip()
        cls = s.get('class') or ''
        if not text or text in generic:
            continue
        if 'btn-xl' in cls:
            continue
        if 'btn-default' in cls or 'submit' in cls.lower() or s.get('type') == 'submit':
            candidates.append((text, cls, s.get('visible')))
    if candidates:
        # Prefer a non-primary default button, which is the action button revealed after upload.
        candidates.sort(key=lambda x: (0 if 'btn-medium' in x[1] else 1, 0 if not x[2] else 1))
        return candidates[0][0], 'dom-hidden'
    return '', 'not-found'

tool_rows = []
for tool in tools:
    route = tool['route']
    data, summary, source, path = page_data(route)
    assert data and summary, f'missing capture for {route}'
    primary = primary_file_inputs(data.get('fileInputs', []))
    accepts = []
    for f in primary:
        acc = f.get('accept') or ''
        if acc and acc not in accepts:
            accepts.append(acc)
    first = primary[0] if primary else {}
    label, label_basis = submit_label(data, route)
    capture = data.get('capture', {})
    html_sha = capture.get('htmlSha256') or summary.get('htmlSha256') or ''
    shot_sha = capture.get('screenshotSha256') or summary.get('screenshotSha256') or ''
    html_path = capture.get('htmlPath') or summary.get('htmlPath') or ''
    shot_path = capture.get('screenshotPath') or summary.get('screenshotPath') or ''
    task_fields = summary.get('taskFields', []) or []
    has_task_form = bool(data.get('hasTaskForm')) or bool(task_fields)
    notes = ''
    if route == '/workflows':
        notes = 'Workflow builder; no data-task and no task form on the captured page.'
    elif route == '/pdf-editor':
        notes = 'Canvas editor; task type edit; extra image/signature/attachment upload forms.'
    elif route == '/pdf-forms':
        notes = 'Form creator; shares the edit task type with the editor.'
    elif route == '/page-numbers-pdf':
        notes = 'Reuses the headerFooter task type.'
    elif route == '/split-pdf-by-size':
        notes = 'No page-specific js/pages script observed; task fields are in the shared bundle or inline page code.'
    elif route in ('/merge-pdf', '/alternate-mix-pdf'):
        notes = 'Dynamic multi-file UI; task fields include dynamically-added options.'
    tool_rows.append({
        'tool_id': tool['tool_id'],
        'tool_name': tool['tool_name'],
        'route': route,
        'group': tool['group'],
        'description': tool['description'],
        'data_task': '|'.join(summary.get('dataTasks', []) or []),
        'task_form_present': 'true' if has_task_form else 'false',
        'file_accept_primary': first.get('accept') or '',
        'file_multiple_primary': 'true' if first.get('multiple') else 'false',
        'file_accept_all': '|'.join(accepts),
        'task_fields': '|'.join(task_fields),
        'submit_label': label,
        'submit_label_basis': label_basis,
        'capture_source': source,
        'html_path': html_path,
        'screenshot_path': shot_path,
        'html_sha256': html_sha,
        'screenshot_sha256': shot_sha,
        'html_artifact_id': f'art_{html_sha}' if html_sha else '',
        'screenshot_artifact_id': f'art_{shot_sha}' if shot_sha else '',
        'evidence_grade': 'CONFIRMED',
        'notes': notes,
    })

# Route inventory.
raw_non_tool = {
    '/': 'site-re/sites/sejda-com/raw/home.real.html',
    '/upgrade': 'site-re/sites/sejda-com/raw/upgrade.html',
    '/desktop': 'site-re/sites/sejda-com/raw/desktop.html',
    '/developers': 'site-re/sites/sejda-com/raw/developers.html',
    '/html-pdf-api': 'site-re/sites/sejda-com/raw/html-pdf-api.html',
    '/help': 'site-re/sites/sejda-com/raw/help.html',
    '/teachers': 'site-re/sites/sejda-com/raw/teachers.html',
}

def title_from_html(rel):
    p = ROOT / rel
    if not p.exists():
        return ''
    text = p.read_text(encoding='utf-8', errors='replace')
    m = re.search(r'<title[^>]*>(.*?)</title>', text, flags=re.I | re.S)
    return re.sub(r'\s+', ' ', m.group(1)).strip() if m else ''

tool_by_route = {r['route']: r for r in tool_rows}
route_rows = []
for route in sorted(tool_routes | set(non_tool_sitemap) | extra_routes):
    if route in tool_routes:
        tr = tool_by_route[route]
        route_rows.append({
            'route': route,
            'url': 'https://www.sejda.com' + route,
            'category': 'tool',
            'tool_id': tr['tool_id'],
            'tool_name': tr['tool_name'],
            'in_sitemap': 'true' if route in english_paths else 'false',
            'in_all_tools_menu': 'true',
            'login_required': 'false',
            'capture_status': 'structured_capture',
            'capture_source': tr['capture_source'],
            'capture_path': tr['html_path'],
            'screenshot_path': tr['screenshot_path'],
            'title': (page_data(route)[0] or {}).get('title', ''),
            'evidence': tr['html_artifact_id'],
            'notes': 'Menu-only tool route.' if route in menu_only_tools else tr['notes'],
        })
    else:
        captured = route in raw_non_tool
        login_required = route == '/account'
        route_rows.append({
            'route': route,
            'url': 'https://www.sejda.com' + route,
            'category': 'account' if login_required else 'page',
            'tool_id': '',
            'tool_name': '',
            'in_sitemap': 'false' if route == '/account' else 'true',
            'in_all_tools_menu': 'false',
            'login_required': 'true' if login_required else 'false',
            'capture_status': 'captured' if captured else ('login_gated' if login_required else 'not_captured'),
            'capture_source': 'prior-html' if captured else '',
            'capture_path': raw_non_tool.get(route, ''),
            'screenshot_path': '',
            'title': title_from_html(raw_non_tool[route]) if captured else '',
            'evidence': '',
            'notes': 'Known header route; absent from sitemap; login-gated.' if login_required else '',
        })

# Locale table.
locale_rows = []
en = {
    'locale_code': 'en',
    'hreflang': 'en',
    'prefix': '',
    'homepage': 'https://www.sejda.com/',
    'sitemap_route_count': len(english_paths),
    'captured_tool_pages': 44,
    'captured_non_tool_pages': len(raw_non_tool),
    'sample_status': 'baseline',
    'notes': 'English source pages; 44/44 tool pages structured, 7 non-tool pages previously captured.',
}
locale_rows.append(en)
for prefix in locale_prefixes:
    hreflang = next((h for h, p in hreflangs.items() if p.strip('/').split('/')[0] == prefix), prefix)
    count = sum(1 for p in paths if p.startswith(f'/{prefix}/'))
    locale_rows.append({
        'locale_code': prefix,
        'hreflang': hreflang,
        'prefix': prefix,
        'homepage': f'https://www.sejda.com/{prefix}/',
        'sitemap_route_count': count,
        'captured_tool_pages': 0,
        'captured_non_tool_pages': 0,
        'sample_status': 'not_sampled',
        'notes': 'No localized page captured in this phase.',
    })

# Coverage metrics.
tool_task_pages = len([r for r in tool_rows if r['data_task']])
unique_tasks = len({t for r in tool_rows for t in r['data_task'].split('|') if t})
workflow_routes_exercised = [
    '/split-pdf', '/merge-pdf', '/header-footer-pdf', '/pdf-to-jpg',
    '/split-pdf-by-outline', '/alternate-mix-pdf', '/encrypt-pdf',
    '/split-pdf-by-size', '/extract-pdf-pages', '/rotate-pdf-pages',
]
task_types_exercised = [
    'splitByPages', 'merge', 'headerFooter', 'pdfToImage',
    'splitByBookmarks', 'alternateMix', 'encrypt',
    'splitBySize', 'extractPages', 'rotatePages',
]
assert set(task_types_exercised) <= {t for r in tool_rows for t in r['data_task'].split('|') if t}
captured_non_tool = len(raw_non_tool)
known_non_tool = len(set(non_tool_sitemap) | extra_routes)
known_unique = len(tool_routes | set(non_tool_sitemap) | extra_routes)
captured_known_unique = 44 + captured_non_tool
sitemap_tool_routes = len(tool_routes & set(english_paths))
captured_sitemap = sitemap_tool_routes + captured_non_tool
observed_api = 5
known_processing_api = 12
sdk_mapped_tasks = [
    'splitByPages', 'extractPages', 'merge', 'rotatePages',
    'splitByBookmarks', 'splitBySize', 'alternateMix', 'headerFooter', 'pdfToImage',
]
sdk_task_types_implemented = len(sdk_mapped_tasks)
sdk_task_types_observed = len([t for t in task_types_exercised if t in sdk_mapped_tasks])
observed_task_types_implemented = [t for t in task_types_exercised if t in sdk_mapped_tasks]
observed_task_types_outside_poc = [t for t in task_types_exercised if t not in sdk_mapped_tasks]

components = {
    'tool pages structured': 100.0 * 44 / 44,
    'unique task types exercised': 100.0 * len(task_types_exercised) / unique_tasks,
    'known processing API paths observed': 100.0 * observed_api / known_processing_api,
    'localized locales sampled': 0.0,
    'edge/error matrix executed': 0.0,
    'account/payment surfaces exercised': 0.0,
}
composite = sum(components.values()) / len(components)

coverage_rows = [
    {
        'dimension': 'English tool pages structured',
        'scope': 'public English tool routes',
        'covered': 44, 'total': 44,
        'percent': 100.0,
        'basis': '35 static CDP pages + 9 REA-bound pages',
        'confidence': 'CONFIRMED',
        'notes': 'DOM, forms, file inputs, task fields, screenshots, and SHA-256 hashes.',
    },
    {
        'dimension': 'English known unique routes captured',
        'scope': '44 tools + 10 sitemap non-tool + /account',
        'covered': captured_known_unique, 'total': known_unique,
        'percent': round(100.0 * captured_known_unique / known_unique, 2),
        'basis': '44 tools + 7 previously captured non-tool pages',
        'confidence': 'CONFIRMED',
        'notes': 'The 4 uncaptured non-tool pages are /login, /reset-password, /press, /account.',
    },
    {
        'dimension': 'English sitemap routes captured',
        'scope': '52 English sitemap paths',
        'covered': captured_sitemap, 'total': len(english_paths),
        'percent': round(100.0 * captured_sitemap / len(english_paths), 2),
        'basis': '42 sitemap tool routes + 7 non-tool pages',
        'confidence': 'CONFIRMED',
        'notes': 'The two menu-only tool routes are outside the sitemap.',
    },
    {
        'dimension': 'Tool routes with a data-task',
        'scope': '44 tool routes',
        'covered': tool_task_pages, 'total': 44,
        'percent': round(100.0 * tool_task_pages / 44, 2),
        'basis': '/workflows is a builder and has no data-task',
        'confidence': 'CONFIRMED',
        'notes': f'{unique_tasks} unique data-task values across {tool_task_pages} task pages.',
    },
    {
        'dimension': 'Unique task types exercised',
        'scope': f'{unique_tasks} unique data-task values',
        'covered': len(task_types_exercised), 'total': unique_tasks,
        'percent': round(100.0 * len(task_types_exercised) / unique_tasks, 2),
        'basis': ', '.join(task_types_exercised),
        'confidence': 'CONFIRMED',
        'notes': 'Ten task types were submitted end to end across three logged-out free-tier windows; the other static forms are inventoried but not submitted.',
    },
    {
        'dimension': 'Tool workflows exercised',
        'scope': '44 tool routes',
        'covered': len(workflow_routes_exercised), 'total': 44,
        'percent': round(100.0 * len(workflow_routes_exercised) / 44, 2),
        'basis': ', '.join(workflow_routes_exercised),
        'confidence': 'CONFIRMED',
        'notes': 'Ten logged-out workflows across three free-tier windows; the latest window used its full 3-task free allowance.',
    },
    {
        'dimension': 'Representative workflow families exercised',
        'scope': '6 analytic families: split, combine, layout, conversion, forms/sign, security',
        'covered': 5, 'total': 6,
        'percent': round(100.0 * 5 / 6, 2),
        'basis': 'splitByPages, splitByBookmarks, merge, alternateMix, headerFooter, pdfToImage, encrypt',
        'confidence': 'ESTIMATE',
        'notes': 'Family grouping is analytic. Security is covered by encrypt; forms/sign remains unexercised.',
    },
    {
        'dimension': 'Known processing API paths observed',
        'scope': '12 processing API paths',
        'covered': observed_api, 'total': known_processing_api,
        'percent': round(100.0 * observed_api / known_processing_api, 2),
        'basis': 'upload-check, upload, tasks, change, download',
        'confidence': 'CONFIRMED',
        'notes': 'Seven client-referenced paths remain unexercised; one contact-search route is excluded.',
    },
    {
        'dimension': 'Non-tool English pages captured',
        'scope': '10 sitemap non-tool + /account',
        'covered': captured_non_tool, 'total': known_non_tool,
        'percent': round(100.0 * captured_non_tool / known_non_tool, 2),
        'basis': 'home, upgrade, desktop, developers, html-pdf-api, help, teachers',
        'confidence': 'CONFIRMED',
        'notes': '/login, /reset-password, /press, /account are not captured.',
    },
    {
        'dimension': 'Non-English locales sampled',
        'scope': '28 localized locales',
        'covered': 0, 'total': 28,
        'percent': 0.0,
        'basis': 'No localized page captured in this phase.',
        'confidence': 'CONFIRMED',
        'notes': 'Planned sample is 28 locales x 4 pages = 112 captures.',
    },
    {
        'dimension': 'Localized route sample captured',
        'scope': '28 locales x 4 pages',
        'covered': 0, 'total': 112,
        'percent': 0.0,
        'basis': 'Homepage, one tool, pricing, login per locale.',
        'confidence': 'CONFIRMED',
        'notes': 'Full 1,344 localized-route coverage is not required unless explicitly requested.',
    },
    {
        'dimension': 'Edge/error matrix executed',
        'scope': 'invalid PDF, encrypted PDF, chunked upload, touch/expiry, cancel/delete, rate limits, signed-URL expiry, CORS/CSRF',
        'covered': 0, 'total': 8,
        'percent': 0.0,
        'basis': 'No edge/error probes executed yet.',
        'confidence': 'CONFIRMED',
        'notes': 'Must respect free-tier and authorization boundaries.',
    },
    {
        'dimension': 'Account/payment surfaces exercised',
        'scope': 'login, account, payment',
        'covered': 0, 'total': 3,
        'percent': 0.0,
        'basis': 'No authorized account or payment test provided.',
        'confidence': 'BLOCKED',
        'notes': 'Do not bypass authentication, authorization, paywalls, or initiate payments.',
    },
    {
        'dimension': 'Web-backend internals verified',
        'scope': 'language, framework, auth, queue, storage, schema, payment provider',
        'covered': 0, 'total': 7,
        'percent': 0.0,
        'basis': 'No web-layer repository, JAR/WAR, image, migrations, or sanitized config.',
        'confidence': 'BLOCKED',
        'notes': 'Public capture cannot establish backend internals.',
    },
    {
        'dimension': 'SDK-mapped task types implemented in Java PoC',
        'scope': '9 unique SDK-mapped public task types',
        'covered': sdk_task_types_implemented, 'total': len(sdk_mapped_tasks),
        'percent': round(100.0 * sdk_task_types_implemented / len(sdk_mapped_tasks), 2),
        'basis': ', '.join(sdk_mapped_tasks),
        'confidence': 'CONFIRMED',
        'notes': (
            f'{sdk_task_types_implemented}/9 local implementations pass smoke; all {sdk_task_types_observed} SDK-mapped types are now observed end-to-end.'
            if sdk_task_types_observed == sdk_task_types_implemented
            else f'{sdk_task_types_implemented}/9 local implementations pass smoke; {sdk_task_types_observed} of those 9 are observed end-to-end, {sdk_task_types_implemented - sdk_task_types_observed} remain inferred from static form semantics.'
        ),
    },
    {
        'dimension': 'All observed task types implemented in Java PoC',
        'scope': f'{unique_tasks} unique observed data-task values',
        'covered': len(observed_task_types_implemented), 'total': unique_tasks,
        'percent': round(100.0 * len(observed_task_types_implemented) / unique_tasks, 2),
        'basis': ', '.join(observed_task_types_implemented),
        'confidence': 'CONFIRMED',
        'notes': f'Independent Apache PDFBox PoC, not the real backend. Outside the bounded PoC: {", ".join(observed_task_types_outside_poc)}. Full 44-tool parity is a P2 decision.',
    },
    {
        'dimension': 'Composite public-behavior estimate',
        'scope': 'equal-weight heuristic across six public dimensions',
        'covered': round(composite, 2), 'total': 100,
        'percent': round(composite, 2),
        'basis': f'mean(tool pages 100, task types {100.0 * len(task_types_exercised) / unique_tasks:.2f}, API paths {100.0 * observed_api / known_processing_api:.2f}, locales 0, edge matrix 0, account/payment 0)',
        'confidence': 'ESTIMATE',
        'notes': 'Not a single true percentage; page inventory is complete, behavior is early.',
    },
]

def write_csv(path, rows, fields):
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)

write_csv(OUT / 'tools.csv', tool_rows, list(tool_rows[0].keys()))
write_csv(OUT / 'routes.csv', route_rows, list(route_rows[0].keys()))
write_csv(OUT / 'locales.csv', locale_rows, list(locale_rows[0].keys()))
write_csv(OUT / 'coverage.csv', coverage_rows, list(coverage_rows[0].keys()))

summary = {
    'generated_at': '2026-10-25T00:00:00Z',
    'sources': {
        'inventory': 'site-re/sites/sejda-com/inventory.md',
        'sitemap': 'site-re/sites/sejda-com/raw/sitemap.xml',
        'hreflang': 'site-re/sites/sejda-com/raw/home.real.html',
        'static_pass': 'reports/_raw/static-pass/summary.json',
        'rea_bundle': 'reports/_raw/static-pass/bundle-pages/summary.json',
    },
    'counts': {
        'tools': len(tool_rows),
        'tool_task_pages': tool_task_pages,
        'unique_data_tasks': unique_tasks,
        'english_sitemap_routes': len(english_paths),
        'non_tool_sitemap_routes': len(non_tool_sitemap),
        'menu_only_tool_routes': len(menu_only_tools),
        'known_unique_english_routes': known_unique,
        'captured_known_unique_routes': captured_known_unique,
        'non_tool_captured': captured_non_tool,
        'non_tool_known': known_non_tool,
        'locales': len(locale_prefixes),
        'locale_routes_total': sum(r['sitemap_route_count'] for r in locale_rows if r['locale_code'] != 'en'),
        'workflow_routes_exercised': workflow_routes_exercised,
        'task_types_exercised': task_types_exercised,
        'observed_task_types_implemented_in_poc': observed_task_types_implemented,
        'observed_task_types_outside_poc': observed_task_types_outside_poc,
        'sdk_task_types_implemented': sdk_task_types_implemented,
        'sdk_task_types_observed_end_to_end': sdk_task_types_observed,
        'sdk_task_types_inferred_from_static_forms': sdk_task_types_implemented - sdk_task_types_observed,
        'composite_public_behavior_estimate': round(composite, 2),
    },
    'components': {k: round(v, 2) for k, v in components.items()},
    'missing_non_tool_pages': sorted((set(non_tool_sitemap) | extra_routes) - set(raw_non_tool)),
    'menu_only_tools': menu_only_tools,
    'unique_data_tasks': sorted({t for r in tool_rows for t in r['data_task'].split('|') if t}),
}
(OUT / 'coverage-build.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, indent=2))
