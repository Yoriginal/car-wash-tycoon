# Journal des versions

Format : `MAJEUR.MINEUR.CORRECTIF`
- **MAJEUR** : refonte qui change la façon de jouer.
- **MINEUR** : nouvelle fonctionnalité (nouvel équipement, marketing, nouvelle carte…).
- **CORRECTIF** : bug, équilibrage, texte.

## 2.0.0 — refonte de l'interface « Néon Diner » (en aperçu)
- Nouvelle direction artistique : clair = on regarde, sombre = on touche, néon = prochaine action.
- HUD haut (trésorerie, date et météo, niveau, cloche) et dock sombre avec cadran de vitesse.
- Station en diorama touchable : enseigne, postes par emplacement et leurs états, file, parvis.
- Panneaux par-dessus le jeu avec pause automatique : Prix au curseur, Entretien, fiche équipement,
  Catalogue, Équipe, Station, File d'attente, Empire, Banque, Missions, Réglages.
- Carte claire déplaçable et zoomable : brouillard, zones par palier, terrains, rivaux, voitures.
- Pop-ups des moments forts (panne, parcelle voisine, mission accomplie, retour d'absence, banque),
  cloche d'alertes et un seul objet en néon pour la prochaine action.
- Écran titre, tutoriel avec Bulle et info-bulles de première fois (passables).
- Pensé pour jouer en ×10 : décor de station toujours de jour, indicateurs de station et tendance
  de la trésorerie sur 30 jours glissants (CA, résultat, lavages, clients perdus par mois),
  estimations du panneau Prix et potentiel des terrains en clients par mois. Pas d'animation de
  pièce à chaque recette : seule la trésorerie défile en continu. Équipement en panne qui grésille,
  mouvements réduits respectés.
- Moteur et format de sauvegarde inchangés : les parties en cours continuent telles quelles.

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
