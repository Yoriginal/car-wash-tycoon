# Car Wash Tycoon — règles de développement

Jeu PWA en HTML/CSS/JS sans dépendance ni framework. Le propriétaire (Yoann) joue sur iPhone : chaque
mise en ligne arrive sur son téléphone, donc **une version ne doit jamais casser une partie en cours**.

## Architecture
- `src/engine.js` : moteur pur (aucun accès au DOM). Toute la logique de jeu est ici et testable sous Node.
- `src/app.js` : interface, rendu, sauvegarde, diorama canvas. Il appelle le moteur via l'objet `E`.
- `src/style.css` : tokens de couleur et de typo en tête de fichier, DA car wash américain rétro néon.
- `scripts/build.mjs` : produit `dist/` (PWA GitHub Pages) et `build/artifact.html` (artifact Claude).
- Ne jamais éditer `dist/` ou `build/` à la main (générés, ignorés par git).

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
2. Coder, puis `npm test` (doit passer).
3. Mettre à jour `GAME_VERSION` dans `engine.js`, `version` dans `package.json` et `CHANGELOG.md`
   (MAJEUR.MINEUR.CORRECTIF).
4. Pull Request vers `main` ; la fusion déclenche les tests puis le déploiement GitHub Pages.
5. Si l'artifact Claude doit suivre : republier `build/artifact.html` sur la même URL d'artifact.

## Conventions
- Textes du jeu en français, ton clair, sans jargon technique.
- Valeurs d'équilibrage fictives, regroupées en constantes en tête de `engine.js`.
- Ajouter un test dans `tests/engine.test.js` pour toute nouvelle mécanique.
- Mobile d'abord : 390 px de large, cibles tactiles de 44 px minimum.

## Feuille de route (idées validées avec Yoann)
- Marketing et fidélisation : cartes, abonnements, avis Google.
- Types de clients, autres équipements (aspirateurs, gonfleurs, tunnel).
- Carte régionale puis nationale.
- Sons, retours haptiques, notifications.
- Version App Store via Capacitor si le jeu prend.
