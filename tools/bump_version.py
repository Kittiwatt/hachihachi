#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tamponne une version (?v=…) sur les chemins des modules et de la feuille de style,
pour contourner le cache (GitHub Pages : max-age=600). À lancer avant chaque push :
    python3 tools/bump_version.py            # tampon = date-heure UTC
    python3 tools/bump_version.py 1.2.0      # tampon explicite"""
import re, sys, os, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
stamp = sys.argv[1] if len(sys.argv) > 1 else datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M')
files = ['index.html', 'ui.js', 'net.js', 'bot.js', 'core.js']
for f in files:
    p = os.path.join(root, f); s = open(p, encoding='utf-8').read()
    s2 = re.sub(r"(from\s+'\./[a-z_]+\.js)(\?v=[^']*)?'", lambda m: f"{m.group(1)}?v={stamp}'", s)
    s2 = re.sub(r"(import\('\./[a-z0-9_./\-]+\.js)(\?v=[^']*)?'\)", lambda m: f"{m.group(1)}?v={stamp}')", s2)
    s2 = re.sub(r'((?:src|href)="(?:ui\.js|style\.css))(\?v=[^"]*)?"', lambda m: f'{m.group(1)}?v={stamp}"', s2)
    if s2 != s: open(p, 'w', encoding='utf-8').write(s2); print('tamponné', f)
print('version', stamp)
