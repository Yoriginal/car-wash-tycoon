# Car Wash Tycoon

Jeu mobile de gestion de stations de lavage, style car wash américain rétro.
Toutes les valeurs de jeu sont fictives.

**Jouer :** https://yoriginal.github.io/car-wash-tycoon/

## Installer sur iPhone
1. Ouvrir le lien dans **Safari**.
2. Toucher **Partager**, puis **Sur l'écran d'accueil**.
3. Lancer le jeu depuis l'icône : plein écran, jouable hors ligne, sauvegarde sur le téléphone.

## Structure
```
src/engine.js      moteur de simulation (pur, testable, sans affichage)
src/app.js         interface, sauvegarde, animations
src/style.css      direction artistique
src/body.html      squelette de la page
pwa/               manifeste, service worker, icônes
scripts/build.mjs  assemble src/ → dist/ (PWA) et build/artifact.html (version Claude)
tests/             tests automatiques (moteur, sauvegardes, build)
CHANGELOG.md       historique des versions
CLAUDE.md          règles de développement (lues par Claude à chaque session)
```

## Commandes
```
npm test        tests + build
npm run build   build seul
npm run serve   build + serveur local sur http://localhost:8080
```

## Mise en ligne
Chaque push sur `main` lance les tests. S'ils passent, GitHub publie automatiquement la nouvelle version.
Les améliorations se font sur une branche dédiée, puis une Pull Request : les tests tournent, et la fusion dans `main` met en ligne.
