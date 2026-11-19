#!/usr/bin/env python3
"""Full gate check for Vice Cover Studio. Run from the repo root:
    python3 scripts/selftest.py
Prints PASS/FAIL per check, exits non-zero on any failure."""
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIT = Path('/home/hatch/workspace/makefun/gta6-cover-art-01-kit/gta6-cover-art-01-kit')
failures = []


def check(ok, label, detail=''):
    print(f"{'PASS' if ok else 'FAIL'}  {label}" + (f' — {detail}' if detail else ''))
    if not ok:
        failures.append(label)


def run(cmd, env=None, cwd=None):
    e = dict(os.environ)
    if env:
        e.update(env)
    return subprocess.run(cmd, env=e, cwd=cwd or ROOT, capture_output=True, text=True)


# 1. main.ts runs twice; outputs byte-identical (deterministic).
for d in ('out1', 'out2'):
    shutil.rmtree(ROOT / d, ignore_errors=True)
r1 = run(['node', 'main.ts'], env={'MAKEFUN_OUTPUT_DIR': str(ROOT / 'out1')})
r2 = run(['node', 'main.ts'], env={'MAKEFUN_OUTPUT_DIR': str(ROOT / 'out2')})
check(r1.returncode == 0 and r2.returncode == 0, 'main.ts runs twice cleanly',
      (r1.stderr.strip() or r2.stderr.strip())[:200])
diff = run(['diff', '-r', 'out1', 'out2'])
check(diff.returncode == 0 and not diff.stdout.strip(), 'main.ts output deterministic (diff -r out1 out2 empty)',
      diff.stdout.strip()[:200])

# 2. dossier.json <= 1.5 MiB and parses as JSON.
dossier = ROOT / 'out1' / 'dossier.json'
try:
    data = json.loads(dossier.read_text())
    check(dossier.stat().st_size <= 1572864, 'dossier.json <= 1.5 MiB',
          f'{dossier.stat().st_size} bytes')
except Exception as e:
    check(False, 'dossier.json parses as JSON', str(e))

# 3. app/ limits: <= 993 files+dirs, <= 48 MiB, index.html <= 1 MiB, no symlinks.
app = ROOT / 'app'
entries = [p for p in app.rglob('*')]
symlinks = [p for p in entries if p.is_symlink()]
total_bytes = sum(p.stat().st_size for p in entries if p.is_file())
check(len(entries) <= 993, 'app/ <= 993 files+dirs', f'{len(entries)} entries')
check(total_bytes <= 50331648, 'app/ <= 48 MiB', f'{total_bytes} bytes')
check((app / 'index.html').stat().st_size <= 1048576, 'app/index.html <= 1 MiB')
check(not symlinks, 'app/ has no symlinks', ', '.join(str(p) for p in symlinks[:5]))

# 4. screenshots/: exactly 4 files, valid PNG/JPEG, <= 256 KiB, long side <= 1280, short >= 480.
from PIL import Image
shots_dir = ROOT / 'screenshots'
files = sorted(p for p in shots_dir.iterdir() if p.is_file() and not p.name.startswith('.'))
check(len(files) == 4, 'screenshots/ holds exactly 4 files', f'{len(files)}: {[p.name for p in files]}')
for p in files:
    try:
        img = Image.open(p)
        img.load()
        w, h = img.size
        ok = (p.stat().st_size <= 262144 and max(w, h) <= 1280 and min(w, h) >= 480
              and img.format in ('PNG', 'JPEG'))
        check(ok, f'screenshot {p.name} valid, <= 256 KiB, {w}x{h}',
              f'{p.stat().st_size} bytes, {img.format}')
    except Exception as e:
        check(False, f'screenshot {p.name} opens', str(e))

# 5. Offline: no external URLs, fetch, XHR, or external src/href under app/.
# (app/fonts/*.txt are licence texts — the SIL licence itself prints its own
# URL — and are never loaded by the app, so they are excluded from the URL
# grep; every file the browser actually loads is checked.)
text_files = []
for p in app.rglob('*'):
    if not p.is_file():
        continue
    if p.suffix.lower() in ('.html', '.js', '.css', '.json', '.md'):
        text_files.append(p)
    elif p.suffix.lower() == '.txt' and 'fonts' not in p.parts:
        text_files.append(p)
bad = []
for p in text_files:
    text = p.read_text(errors='ignore')
    for pat, label in [
        (r'https?://', 'absolute URL'),
        (r'''["'=]//[A-Za-z0-9]''', 'protocol-relative URL'),
        (r'\bfetch\s*\(', 'fetch('),
        (r'XMLHttpRequest', 'XMLHttpRequest'),
    ]:
        if re.search(pat, text):
            bad.append(f'{p.relative_to(ROOT)}: {label}')
    for m in re.finditer(r'''(?:src|href)\s*=\s*["']([^"']+)["']''', text):
        url = m.group(1)
        if url.startswith(('data:', './', '../', '#')) or re.match(r'^[A-Za-z0-9_.\-/]+$', url):
            continue
        bad.append(f'{p.relative_to(ROOT)}: external src/href {url!r}')
check(not bad, 'app/ is offline (no external URLs, fetch, XHR)', '; '.join(bad[:5]))

# 6. README badges.
readme = (ROOT / 'README.md').read_text()
needles = [
    'https://make.fun/badge/gta6-cover-art-01.svg',
    'https://make.fun/badge/gta6-cover-art-01/wwwmrleee-cloud/gta6-cover-art/rank.svg',
    'https://make.fun/badge/gta6-cover-art-01/wwwmrleee-cloud/gta6-cover-art/reward.svg',
]
check(all(n in readme for n in needles), 'README.md has all three make.fun badges with wwwmrleee-cloud/gta6-cover-art',
      f"missing: {[n for n in needles if n not in readme]}")
check('{owner}' not in readme and '{repo}' not in readme, 'README.md has no {owner}/{repo} placeholders')

# 7. LICENSE names MIT; main.ts exists; vendor file byte-identical to the kit's.
lic = (ROOT / 'LICENSE').read_text(errors='ignore')
check('MIT' in lic, 'LICENSE exists and names MIT')
check((ROOT / 'main.ts').is_file(), 'main.ts exists at repo root')
kit_vendor = KIT / 'starter' / 'vendor' / 'makefun-app.ts'
ours = ROOT / 'vendor' / 'makefun-app.ts'
check(ours.read_bytes() == kit_vendor.read_bytes(), 'vendor/makefun-app.ts byte-identical to the kit copy')

# 8. Fonts: three TTFs + OFL.txt exist and non-empty; every referenced font file exists.
fonts = app / 'fonts'
for name in ('Anton-Regular.ttf', 'BebasNeue-Regular.ttf', 'Pacifico-Regular.ttf', 'OFL.txt'):
    f = fonts / name
    check(f.is_file() and f.stat().st_size > 0, f'app/fonts/{name} exists and non-empty',
          f'{f.stat().st_size if f.exists() else 0} bytes')
css = (app / 'style.css').read_text()
missing = [u for u in re.findall(r"url\(['\"]?([^)'\"]+)['\"]?\)", css)
           if not (app / u.lstrip('./')).exists() and not u.startswith('data:')]
check(not missing, 'every font file referenced in CSS exists', ', '.join(missing))

# 9. Screenshots are not blank (pixel stddev above threshold).
for p in files:
    try:
        img = Image.open(p).convert('L').resize((160, 160))
        sd = statistics.pstdev(list(img.getdata()))
        check(sd > 12, f'screenshot {p.name} is not blank (stddev {sd:.1f})')
    except Exception as e:
        check(False, f'screenshot {p.name} pixel check', str(e))

shutil.rmtree(ROOT / 'out1', ignore_errors=True)
shutil.rmtree(ROOT / 'out2', ignore_errors=True)
if failures:
    print(f'SELFTEST FAILED: {len(failures)} check(s) failed')
    sys.exit(1)
print('SELFTEST OK')
