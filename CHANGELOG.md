# Journal des versions

Format : `MAJEUR.MINEUR.CORRECTIF`
- **MAJEUR** : refonte qui change la façon de jouer.
- **MINEUR** : nouvelle fonctionnalité (nouvel équipement, marketing, nouvelle carte…).
- **CORRECTIF** : bug, équilibrage, texte.

## 3.0.0 — moteur v3 (en aperçu)
- Carte en villes : chaque case est une ville (village, bourg, petite ville, ville, grande ville)
  avec 3 à 6 terrains selon sa taille ; 14 nouveaux terrains, les anciens gardent leur place.
- Finances : bilan annuel (CA, résultat, lavages par année), comparaison avec l'année précédente
  sur la même période et CA mois par mois des deux années.
- Nom de station gardé dans la sauvegarde (les noms donnés en 2.0 sont repris automatiquement).
- Clients perdus réalistes : repartis d'une file pleine, découragés par la file, découragés par un
  prix au-dessus du prix habituel du coin ; détail dans le panneau File d'attente.
- Sauvegarde au format 4 : migration automatique des parties 1.1 / 2.0, copie de l'ancienne gardée.
- L'aperçu joue sur une copie de la partie : le jeu principal n'est jamais touché par un moteur
  plus récent ; Réglages → « Repartir de ma partie du jeu ».

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
- Banque renommée Finances ; tendance de la trésorerie (résultat sur 30 jours) recalculée une fois
  par semaine de jeu pour ne plus bouger avec le compteur.
- Pannes en simple message (et dans la cloche), sans pop-up à valider.
- Objectif en cours : anneau de progression rose autour du rond Missions ; la bulle d'objectif
  n'apparaît que 5 secondes quand un nouvel objectif commence.
- Indicateur « perdus » renommé « repartis » (clients partis d'une file pleine).
- Nommer sa station à l'achat d'un terrain, et la renommer depuis le panneau Station.
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
