# Builds the page for publishing the game as a claude.ai Artifact (for testing on iPad).
# Artifacts wrap the page in their own <!doctype>/<html>/<head>/<body>, so this strips those
# from index.html and keeps everything else. style.css and src/*.js are published alongside
# as-is, at the same relative paths.
#   python3 tools/artifact_page.py <output.html>
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
for pattern in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'</html>\s*', r'<head>\s*', r'</head>\s*',
                r'<body>\s*', r'</body>\s*', r'<meta charset="utf-8">\s*']:
    html = re.sub(pattern, '', html, flags=re.I)
out = Path(sys.argv[1])
out.write_text(html)
print(f'wrote {out}')
print('publish with files:', ', '.join(['style.css'] + sorted(f'src/{p.name}' for p in (root / 'src').glob('*.js'))))
