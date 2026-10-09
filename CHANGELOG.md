# Journal des versions

Format : `MAJEUR.MINEUR.CORRECTIF`
- **MAJEUR** : refonte qui change la façon de jouer.
- **MINEUR** : nouvelle fonctionnalité (nouvel équipement, marketing, nouvelle carte…).
- **CORRECTIF** : bug, équilibrage, texte.

## Infrastructure — 2026-10-09
- Canal d'aperçu : la branche `feat/refonte-ui` est publiée dans `/preview/` pour être testée avant fusion.
- Service worker cloisonné par canal (jeu / aperçu) : caches séparés, aucune interférence.

## 1.1.0 — 2026-10-09
- Version PWA installable sur iPhone (écran d'accueil, plein écran, hors ligne).
- Correction : la partie repartait à zéro à chaque ouverture dans Claude.
- Sauvegarde versionnée avec migrations automatiques (une mise à jour ne casse plus une partie).
- Copie de sécurité automatique de l'ancienne sauvegarde avant migration.
- Export / import de partie par code (Finances → Réglages).
- Numéro de version affiché dans les Réglages.
- Message « nouvelle version téléchargée » quand une mise à jour arrive.

## 1.0.0 — 2026-10-08
- Prototype V0.1 : carte en brouillard, terrains de 2 à 8 emplacements, zones évolutives et signaux faibles.
- Portique et piste HP en 3 gammes, 2 chimies, 4 contrats de maintenance, pannes.
- Prix libres, file d'attente, météo, saisons, événements.
- 2 rivaux IA, banque et prêts, faillite, personnel partageable, parcelle voisine.
- Temps réel ×1/×3/×10 ou tour par tour, revenus hors ligne, 9 objectifs.
