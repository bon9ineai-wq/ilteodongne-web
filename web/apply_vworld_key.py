# Writes web/vworld-config.js from VWORLD_API_KEY when that env var is set.
# Otherwise keeps the file already in the repo. Never prints the key.
import json, os, pathlib, re, sys

p = pathlib.Path(__file__).with_name('vworld-config.js')
env = os.environ.get('VWORLD_API_KEY', '').strip()
if env:
    p.write_text('window.VWORLD_KEY=' + json.dumps(env) + ';\n')
    print('vworld config from secret, length', len(env))
    sys.exit(0)
text = p.read_text(encoding='utf-8') if p.exists() else ''
m = re.search(r'window\.VWORLD_KEY="([^"]*)"', text)
n = len(m.group(1)) if m else 0
if n < 10:
    sys.exit('VWORLD_API_KEY is unset and vworld-config.js has no key')
print('vworld config from file, length', n)
