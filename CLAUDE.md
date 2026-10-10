# Car Wash Tycoon — règles de développement

Jeu PWA en HTML/CSS/JS sans dépendance ni framework. Le propriétaire (Yoann) joue sur iPhone : chaque
mise en ligne arrive sur son téléphone, donc **une version ne doit jamais casser une partie en cours**.

## Architecture
- `src/engine.js` : moteur pur (aucun accès au DOM). Toute la logique de jeu est ici et testable sous Node.
  **Ne pas le modifier sans accord explicite de Yoann** (règles, valeurs, format de sauvegarde).
- `src/ui/*.js` : modules d'interface, concaténés par ordre alphabétique dans une seule portée par le build.
  Ils lisent l'état `S` et appellent le moteur via `E`, sans jamais ajouter de champ à `S`.
- `src/assets/` : graphismes nettoyés (générés par `scripts/import-assets.mjs` depuis `design/pack/`),
  exposés dans le code par `ASSETS['dossier/nom']` et `ASSET_DEFS`. `tokens.css` = source des couleurs.
- `src/style.css` : styles ; `src/body.html` : squelette.
- `design/` : brief, planches et pack Claude Design d'origine (référence, jamais chargés par le jeu).
- `scripts/build.mjs` : produit `dist/` (PWA) ; `PREVIEW=1` produit l'aperçu servi dans `/preview/`.
- Ne jamais éditer `dist/` ou `build/` à la main (générés, ignorés par git).

## Préférences d'interface
- Ce que l'interface doit retenir (tutoriel vu, info-bulles, son) va dans la clé `cwt-ui-v1`, jamais dans `S`.

## Canal d'aperçu
- La branche `feat/refonte-ui` est publiée dans `/preview/` (même appareil, même sauvegarde que le jeu).
- À chaque ouverture de l'aperçu, la partie est copiée dans `cwt-backup-apercu-1..3` (rotation).
- Le service worker de chaque canal a ses propres caches ; celui du jeu ignore `/preview/`.

## Sauvegardes (règle la plus importante)
- La clé `localStorage` `cwt-save-v3` ne change jamais.
- L'état est du JSON pur. Toute modification de sa structure (champ ajouté, renommé, déplacé) impose :
  1. incrémenter `SAVE_VERSION` dans `engine.js` ;
  2. ajouter `MIGRATIONS[ancienne_version]` qui transforme l'ancien état ;
  3. vérifier que `npm test` passe (un test refuse un format sans migration).
- Un champ simplement ajouté avec une valeur par défaut peut aussi passer par `repair()`/`newGameSkeleton()`.
- Avant migration, l'app garde une copie `cwt-backup-v<n>` de l'ancienne sauvegarde.

## Processus de version
1. Créer une branche `feat/<sujet>` ou `fix/<sujet>`.
2. Coder, puis `npm test` et `npm run test:ui` (doivent passer ; le second charge une vraie partie 1.1).
3. Mettre à jour `version` dans `package.json` (affichée dans le jeu) et `CHANGELOG.md`
   (MAJEUR.MINEUR.CORRECTIF). `GAME_VERSION` du moteur ne bouge que si le moteur change.
4. Pull Request vers `main` ; la fusion déclenche les tests puis le déploiement GitHub Pages.
5. Si l'artifact Claude doit suivre : republier `build/artifact.html` sur la même URL d'artifact.

## Conventions
- Textes du jeu en français, ton clair, sans jargon technique.
- Valeurs d'équilibrage fictives, regroupées en constantes en tête de `engine.js`.
- Ajouter un test dans `tests/engine.test.js` pour toute nouvelle mécanique.
- Mobile d'abord : 390 px de large, cibles tactiles de 44 px minimum.

## Règle de découpage des versions (Yoann)
- Ce qui touche au moteur ou à la sauvegarde attend une version majeure (v3, v4…).
- Les améliorations d'interface (mineures) sont faites tout de suite.

## Prochaine version majeure (v3, moteur) — demandé par Yoann le 2026-10-10
- Finances : CA annuel comparé aux années précédentes (le moteur ne garde que 60 j par station et
  120 j au global ; il faut un historique annuel dans la sauvegarde, avec migration).
- Carte en villes : chaque case = une ville différente, avec 3 à 6 emplacements selon sa taille
  (refonte des zones et terrains du moteur, migration des terrains existants).
- Nom de station dans la sauvegarde (aujourd'hui dans `cwt-ui-v1`, à migrer dans `S`).
- Clients perdus réalistes : compter aussi les clients découragés par la file (aujourd'hui ils vont
  « ailleurs » sans être comptés) et par le prix ; l'indicateur actuel ne compte que les clients
  repartis d'une file pleine (souvent 0 quand les postes ont de la marge).

## Feuille de route (idées validées avec Yoann)
- Marketing et fidélisation : cartes, abonnements, avis Google.
- Types de clients, autres équipements (aspirateurs, gonfleurs, tunnel).
- Carte régionale puis nationale.
- Sons, retours haptiques, notifications.
- Version App Store via Capacitor si le jeu prend.
