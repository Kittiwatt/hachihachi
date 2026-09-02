# Hachi-Hachi · 八八 — jouer en ligne entre amis

Application web **100 % statique** pour jouer au Hachi-Hachi (hanafuda, 2 à 6 joueurs) : règles arbitrées
(teyaku, dekiyaku, multiplicateur, phase d'abandon, paiements), parties par code ou lien, sans compte ni serveur.
Projet Anofelis. Règles d'après [fudawiki](https://fudawiki.org/en/hanafuda/games/hachi-hachi).

## Déployer sur GitHub Pages

1. Créer un dépôt **public**, y copier tout le contenu de ce dossier **à la racine** (`index.html` à la racine,
   avec `cards/`, `vendor/`, `.nojekyll`).
2. Settings → Pages → *Deploy from a branch* → branche `main`, dossier `/ (root)`.
3. L'app est servie à `https://<compte>.github.io/<dépôt>/`. Aucune étape de build : ce sont des modules ES natifs.

Elle fonctionne aussi depuis n'importe quel hébergement statique, ou en local avec `python3 -m http.server`
(pas en `file://` : les modules ES et `fetch` exigent HTTP).

## Comment ça marche

- **Hôte-arbitre** : celui qui crée la table fait tourner le moteur de règles dans son navigateur. Il est aussi joueur.
  Les autres reçoivent une vue filtrée (leur main, les captures de tous, la rivière, le nombre de cartes des autres)
  et envoient leurs actions ; l'hôte valide et rediffuse. Conséquence : seul l'hôte « voit » toutes les mains
  (dans la mémoire de son navigateur, pas à l'écran). Entre amis, on l'assume.
- **Mise en relation** : [Trystero](https://github.com/dmotz/trystero) (stratégie Nostr, relais publics, aucun compte),
  puis WebRTC direct entre navigateurs. Un serveur TURN public (Open Relay) sert de secours pour les réseaux
  restrictifs — sans garantie absolue.
- **Reconnexion** : un jeton par table est gardé dans `localStorage`. Revenir sur la même table (même lien) rend
  le même siège et la même main. Un joueur déconnecté est joué par l'hôte après 15 s pour ne pas bloquer la table.
- **Migration d'hôte** : si l'hôte disparaît, le joueur connecté dont l'identifiant de pair est le plus petit
  reprend l'arbitrage 4 s après la détection : les scores, le mois, l'OYA, les multiplicateurs reportés et le pot
  sont conservés ; **la manche en cours est redistribuée** (la pioche secrète n'existait que chez l'hôte).
- **Bots** : jouent depuis la même vue filtrée qu'un humain (ils ne trichent pas), pour compléter une table ou
  jouer seul.

## Fichiers

| Fichier | Rôle |
|---|---|
| `core.js` | Moteur pur (aucune dépendance) : cartes, teyaku, dekiyaku, donne, multiplicateur, abandon, tours, sage/shoubu/annulation, paiements, cas spéciaux, hauts faits, variantes. Déterministe (RNG à graine). |
| `bot.js` | Bot simple (glouton, sens des yaku, abandon selon la force de la main). |
| `net.js` | Session hôte/invité sur Trystero : protocole, sièges, jetons, reconnexion, migration. |
| `ui.js`, `index.html`, `style.css` | Interface (accueil, salon, table, résultats, historique, aide). |
| `cards.js`, `cards/` | Données et images des 48 cartes (générées par `tools/gen_cards.py` depuis le zip fudawiki). |
| `vendor/trystero-nostr.min.js` | Bundle ESM autonome de `@trystero-p2p/nostr` 0.25.4 (esbuild). |
| `tests/` | `node tests/test_core.mjs` (31 tests : détections, scoring, abandon, 100 parties simulées) · `node tests/test_bot.mjs` (60 parties de bots) · `tests/e2e/` (Playwright : solo, mobile, P2P à deux navigateurs, reconnexion, migration). |

## Réglages de table

Manches (3/6/12), valeur du kan (10 ou 12 points), et variantes : Sanglier-Cerf-Papillons, Sept Rubans +1,
règle de responsabilité, multiplicateurs cumulés, « toujours trois joueurs », comportement à deux volontaires.
Par défaut : règles standard de fudawiki.

## Limites connues

- Les relais Nostr publics et le TURN de secours sont des services tiers gratuits : disponibilité non garantie.
- Pas de spectateurs, pas de persistance de partie au-delà de la session de l'hôte.
- 7 joueurs (carte blanche) non implémenté ; échange de main avec l'OYA et *mizuten* non implémentés.
