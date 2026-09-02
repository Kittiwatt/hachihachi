#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère cards.js (données des 48 cartes) et cards/*.jpg à partir du zip
fudawiki (00-index.csv + 48-cartes/*.png + variantes/dos-de-carte.png).
Usage : python3 tools/gen_cards.py ../hanafuda"""
import csv, json, os, sys
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else '../hanafuda'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(root, 'cards'), exist_ok=True)

MOIS = {1: 'Pin', 2: 'Abricotier', 3: 'Cerisier', 4: 'Glycine', 5: 'Iris',
        6: 'Pivoine', 7: 'Lespédèze', 8: 'Susuki', 9: 'Chrysanthème',
        10: 'Érable', 11: 'Saule', 12: 'Paulownia'}
TYPE = {'lumiere': 'bright', 'animal': 'animal', 'ruban': 'ribbon',
        'normale': 'chaff'}
TYPE_FR = {'bright': 'Lumière', 'animal': 'Animal', 'ribbon': 'Ruban',
           'chaff': 'Écaille'}
TAG = {'grue': 'crane', 'rideau': 'curtain', 'lune': 'moon',
       'homme-au-parapluie': 'rain', 'phoenix': 'phoenix', 'poeme': 'poetry',
       'bleu': 'blue', 'sanglier': 'boar', 'cerf': 'deer',
       'papillons': 'butterfly', 'coupe-de-sake': 'sake'}
DETAIL = {'grue': 'grue au soleil', 'poeme': 'ruban-poème',
          'bouscarle': 'bouscarle', 'rideau': 'rideau', 'coucou': 'coucou',
          'rouge': 'ruban rouge', 'pont': 'pont de yatsuhashi',
          'papillons': 'papillons', 'bleu': 'ruban bleu', 'sanglier': 'sanglier',
          'lune': 'pleine lune', 'oies': 'oies sauvages',
          'coupe-de-sake': 'coupe de saké', 'cerf': 'cerf',
          'homme-au-parapluie': 'homme à la pluie', 'hirondelle': 'hirondelle',
          'foudre': 'foudre', 'phoenix': 'phénix', '3-jaune': 'écaille jaune'}

rows = list(csv.DictReader(open(os.path.join(src, '00-index.csv'),
                                encoding='utf-8', newline='')))
rows.sort(key=lambda r: (int(r['mois']), -int(r['points']), r['carte']))
cards = []
for i, r in enumerate(rows):
    code = os.path.splitext(r['fichier'])[0]
    m, t = int(r['mois']), TYPE[r['famille']]
    tag = TAG.get(r['carte'])
    if m == 11 and t == 'ribbon': tag = 'willowRibbon'
    det = DETAIL.get(r['carte'], '')
    name = f"{MOIS[m]} · {TYPE_FR[t]}" + (f" ({det})" if det else f" {r['carte']}")
    cards.append({'id': i, 'code': code, 'month': m, 'type': t, 'tag': tag,
                  'pts': int(r['points']), 'name': name,
                  'flower': MOIS[m]})
    dst = os.path.join(root, 'cards', code + '.jpg')
    if not os.path.exists(dst):
        Image.open(os.path.join(src, '48-cartes', r['fichier'])) \
             .convert('RGB').resize((260, 430), Image.LANCZOS) \
             .save(dst, quality=84, optimize=True)
Image.open(os.path.join(src, 'variantes', 'dos-de-carte.png')).convert('RGB') \
     .resize((260, 430), Image.LANCZOS) \
     .save(os.path.join(root, 'cards', 'dos.jpg'), quality=84, optimize=True)

js = ("// Généré par tools/gen_cards.py — ne pas éditer à la main.\n"
      "export const CARDS = " + json.dumps(cards, ensure_ascii=False, indent=1)
      + ";\nexport const MONTHS = " + json.dumps(MOIS, ensure_ascii=False)
      + ";\n")
open(os.path.join(root, 'cards.js'), 'w', encoding='utf-8').write(js)
print(len(cards), 'cartes ->', os.path.join(root, 'cards.js'))
