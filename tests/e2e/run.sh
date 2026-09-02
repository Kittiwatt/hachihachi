#!/bin/bash
# Lance un scénario Playwright contre l'app servie en local (http://localhost:8765).
# Prérequis : npm i -D playwright && npx playwright install chromium
cd "$(dirname "$0")/../.." && python3 -m http.server 8765 > /dev/null 2>&1 &
SRV=$!; sleep 1
node "$(dirname "$0")/$1"
kill $SRV 2>/dev/null
