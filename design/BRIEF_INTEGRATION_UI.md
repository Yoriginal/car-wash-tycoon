# Car Wash Tycoon — Brief d'intégration de la refonte UI/UX

Destinataire : Claude Code, sur le dépôt du jeu (PWA iPhone, portrait).
Objectif : remplacer l'interface « site web » (onglets, listes, formulaires) par une interface de jeu où l'on voit le monde et la station, et où l'on touche les objets pour agir.

---

## 0. Ce qui ne change pas

- **Le moteur et les règles du jeu.** Aucune modification de la logique de simulation, des formules, des valeurs ou du format de sauvegarde. Si une donnée affichée n'existe pas dans le moteur, on ne l'invente pas : on la signale (voir § 10).
- PWA iPhone, format portrait, textes en français.
- Pas de moteur 3D. Interface en HTML/CSS ; carte et diorama en SVG ou Canvas 2D.
- Polices Google Fonts uniquement. Poids total des graphismes visé : moins de 2 Mo.
- **Livraison par étapes, sans jamais casser le jeu.** Chaque étape du § 9 se termine par un jeu jouable, puis un commit.

## 1. Contenu du pack

| Dossier / fichier | Contenu | Usage |
|---|---|---|
| `tokens.css` | Couleurs, rayons, hauteurs, polices | À importer tel quel, source unique des valeurs |
| `equipements/` | Portique et piste HP : 3 gammes × 4 états, plus l'emplacement libre (viewBox 120 × 150) | Sprites du diorama Station |
| `monde/` | Zones par palier (1 à 5), brouillard, terrains, signal faible, stations (la mienne, rivaux), fonds à céder, voitures, enseigne | Éléments de la carte Monde |
| `icones/` | 32 icônes, grille 24 px, trait 2 px, `stroke="currentColor"` | HUD, dock, boutons, panneaux |
| `ui/` | Fiche terrain, panneau Prix, 4 pop-ups, Bulle en 3 humeurs (`ok`, `joie`, `oups`) | Références de composants ; Bulle utilisable directement |
| `ecrans/` | 8 écrans complets 390 × 844 : Station, Monde (3 états), Catalogue, Empire, Banque, Missions | **Références visuelles uniquement**, ne pas les intégrer comme images |

Les planches PDF (`Car_Wash_Tycoon_kit_et_decor.pdf`, `Car_Wash_Tycoon_maquettes.pdf`, `Car_Wash_Tycoon_piste_A_dock.pdf`) font foi pour le rendu attendu.

**Attention aux SVG du pack :**
- Ils embarquent des `<defs>` aux identifiants fixes (`k_glow`, `k_dots`, `a5_glow`…). Si plusieurs sont injectés en ligne dans la même page, les identifiants se télescopent. Préfixer les id à l'import (par exemple SVGO `prefixIds`) ou passer par un sprite `<symbol>` unique.
- Certains contiennent du texte (plaques ÉCO / PRO / PREMIUM, « À VENDRE »…) en Barlow Condensed. Utilisés via `<img>`, la police de la page ne s'applique pas. Préférer l'injection en ligne, ou retirer ces textes du SVG et les poser en HTML par-dessus.
- Le halo (filtre SVG `glow`) est coûteux. En production, le remplacer par un `filter: drop-shadow()` CSS sur l'élément actif uniquement (voir § 7).

## 2. Règles de lecture (validées, non négociables)

1. **Clair = on regarde.** Décor, carte, informations : fond blanc cassé, texte encre.
2. **Sombre = on touche.** Tout ce qui réagit au toucher est un « caisson » sombre (`--caisson`). **Réciproquement, un élément sombre doit toujours réagir au toucher.**
3. **Néon allumé = la prochaine action.** Contour aqua avec halo. Une ou deux choses à la fois au maximum, sinon il ne guide plus.
4. **Le dock du bas est entièrement sombre** : c'est la zone du pouce, tout ce qui s'y trouve est un bouton.

### Grammaire des formes

| Forme | Rôle | Exemples |
|---|---|---|
| Capsule (rayon = moitié de la hauteur) | Se touche, avec texte | Boutons, outils, trésorerie, météo, objectif, plaques de poste, panneau de file, lignes de station (Empire), prêts |
| Rond | Se touche, icône seule | Cloche, navigation, « + » d'emplacement libre, cadran de vitesse, cadenas du brouillard |
| Aucun cadre | Se lit | Indicateurs, date, niveau, palier, KPI, libellés |
| Feuille (coins 24 px) | S'ouvre par-dessus le jeu | Panneaux, pop-ups |
| Angle Googie (parallélogramme incliné) | Décor uniquement | Enseigne, panneau tarifaire, bâtiments |

Pictos d'état : 5 silhouettes distinctes, la forme porte le sens (un état ne se signale **jamais** par la seule couleur).

| Niveau | Forme | Couleur | Cas |
|---|---|---|---|
| Critique | Triangle + ! | `--rouge` | Panne, découvert, file pleine |
| Opportunité | Losange + flèche | `--ambre` | Terrain en vente, parcelle voisine, signal de croissance |
| Info | Rond + i | `--ciel` | Rival installé |
| Récompense | Étoile | `--neon-rose` | Objectif atteint |
| OK | Carré arrondi + coche | `--vert` | Tout tourne |

Le picto se pose **sur l'objet concerné** (équipement, station sur la carte, bouton du dock), jamais seul dans une liste.

## 3. Tokens

Importer `tokens.css`. Valeurs principales :

- Fond `#F7F4EE`, surface `#FFFFFF`, carrelage `#EFEBE3`, encre `#171B1E`, encre secondaire `#6A7276`, filet `#D8D2C6`
- Caisson `#1B2024`, caisson dans le dock `#2C3237`, texte sur caisson `#F4F0E6`
- Néon aqua `#14BFAE` (prochaine action), néon rose `#FF2E7A` (enseignes, récompense), ambre `#F5A300`, rouge `#EE3B30`, ciel `#1E97E0`, vert `#22A447`
- Bouton : hauteur 48 px (44 minimum), rayon = moitié de la hauteur. Feuilles : rayon 24 px.

Typographies (Google Fonts) : **Righteous** (titres, noms de lieux), **Barlow Condensed** 600/700 (interface et chiffres, `font-variant-numeric: tabular-nums`), **Monoton** (logo et enseignes uniquement).

**Contraste :** jamais de texte aqua, ambre ou vert clair sur fond blanc. Ces couleurs servent aux aplats, icônes et jauges ; le texte reste en encre. Sur caisson sombre, l'aqua est autorisé en texte.

## 4. Navigation

Deux écrans de jeu seulement : **Monde** (accueil) et **Station**. Tout le reste s'ouvre par-dessus en feuille et se referme pour revenir là où l'on était.

- Monde → toucher ma station : zoom animé vers l'écran Station.
- Monde → toucher un terrain : fiche Terrain en panneau bas mi-hauteur.
- Monde → toucher un brouillard : fiche Reconnaissance.
- Station → toucher un objet : panneau de l'objet. Toucher un emplacement libre : Catalogue filtré.
- Dock (Monde et Station) : Monde, Empire, cadran de vitesse, Missions, Banque.
- Empire → toucher une station : écran Station de cette station.
- Cloche → liste des alertes, chacune mène à l'objet concerné (sur la carte ou dans la station).

**Pause naturelle :** ouvrir une feuille de décision met le temps en pause et affiche « en pause » dans son en-tête ; la fermer relance le temps à la vitesse précédente.
**Fermeture :** glisser vers le bas ou toucher le décor voilé. Pas de bouton croix.

## 5. Spécifications par zone

### 5.1 HUD haut (Monde et Station)

Hauteur 54 px sous la zone sûre, fond blanc, filet en bas.

| Zone | Élément | Toucher |
|---|---|---|
| Gauche | Capsule sombre : pièce + trésorerie (Barlow 21, rouge si négative) + tendance du jour (▲ vert / ▼ rouge) | Banque |
| Centre, ligne 1 | Date et heure de jeu, sans cadre | — |
| Centre, ligne 2 | Capsule sombre : icône météo + température + événement (Pollen, Sel, Vacances) | Prévision et effet sur la demande |
| Droite | « NIVEAU » + chiffre, sans cadre | — |
| Extrême droite | Rond sombre : cloche + compteur rouge | Liste des alertes |

### 5.2 Dock (bande sombre en bas)

- **Sur Station uniquement**, une rangée d'outils au-dessus : 4 capsules `#2C3237` (Prix, Entretien, Équipe, Station), icône 18 px + libellé.
- Rangée de navigation : 4 ronds de 46 px (Monde, Empire, Missions, Banque) avec libellé dessous, et au centre le **cadran de vitesse** (rond de 76 px, contour néon).
- Cadran : toucher = pause / reprise ; glisser = vitesse (pause, ×1, ×3, ×10, ou « tour suivant » en mode tour par tour). Aiguille et chiffre actif en aqua.
- Écran actif : son rond est cerclé de néon et son icône passe en aqua.
- Un picto (étoile, triangle…) peut se poser sur un rond du dock pour signaler quelque chose à aller voir.

### 5.3 Écran Station (diorama)

Référence : `ecrans/station_petite_station.svg`.

- Scène d'environ 58 % de l'écran, en SVG ou Canvas 2D. De haut en bas :
  - **enseigne** Googie (nom + panneau tarifaire) en haut à gauche ;
  - bâtiment d'arrière-plan selon le palier de la zone ;
  - **bâtiment de lavage** avec un poste par emplacement, chacun surmonté de sa plaque de gamme (capsule sombre) ;
  - **parvis** avec la file de voitures et le panneau de file.
- Équipement : sprite `equipements/{portique|piste}_{eco|pro|premium}_{arret|actif|panne|usure}.svg`.
- Bandeau de 4 indicateurs, sans cadre : servis, perdus, file (n/cap), CA du jour.
- Bulle d'objectif : capsule sombre posée en bas de la scène (toucher = Missions).

| Objet touchable | Toucher |
|---|---|
| Plaque de poste / équipement | Fiche équipement (âge, fiabilité, capacité ; Améliorer, Revendre) |
| Équipement en panne | Fiche panne (délai, coût, lien contrat d'entretien) |
| Emplacement libre (rond sombre + « + ») | Catalogue filtré sur ce qui rentre |
| Enseigne | Panneau Prix |
| Panneau de file | Clients perdus + conseil |
| Employé | Fiche employé |
| Panneau « À vendre » voisin | Offre d'extension |

### 5.4 Écran Monde (accueil)

Références : `ecrans/monde_1_debut.svg`, `monde_2_mi_partie.svg`, `monde_3_mutation.svg`.

- Carte du département en plein écran entre HUD et dock, déplaçable et zoomable au doigt.
- Décor clair : mer, rivière, routes, frontières de secteurs en pointillé, noms de secteurs en petites capitales.
- Secteur non reconnu : papier jauni + nuages, **rond sombre avec cadenas** au centre et prix (2 000 €).
- Zones : bâtiments qui grossissent avec le palier (`monde/zone_palier_1..5.svg`).
- Terrain libre : parcelle en pointillé + panneau capsule sombre « À VENDRE ». La taille dessinée reflète le nombre d'emplacements.
- Terrain étudié : parcelle aqua + capsule sombre avec étoiles de potentiel.
- Signal faible : grue + losange ambre.
- Ma station : enseigne néon rose à son nom + picto d'état (ok / panne / file pleine).
- Rivaux : enseigne à leurs couleurs (Discount Wash `#FF7A1A`, Splash & Co `#8A5BE0`) + picto info.
- Petites voitures colorées qui circulent sur les routes.
- La sélection d'un terrain l'entoure d'un néon aqua et ouvre la fiche Terrain à mi-hauteur.

### 5.5 Feuilles (panneaux)

En-tête commun : poignée de glissement, icône du lieu, titre en Righteous, sous-titre en petites capitales, indicateur « en pause ».
Actions **empilées en bas**, la recommandée en néon en haut de la pile, le montant aligné à droite dans le bouton.

| Feuille | Lieu | Contenu clé | Référence |
|---|---|---|---|
| Fiche Terrain | — | Palier, taille, 3 jauges (potentiel flou puis précis après étude, concurrence, tendance), Étudier / Acheter / Acheter avec un prêt | `ui/fiche_terrain.svg` |
| Prix | — | Une ligne par type d'équipement : prix en gros, curseur 1–40 €, repère du prix de référence, attractivité, « ≈ N clients/jour » mis à jour pendant le glissé | `ui/panneau_prix.svg` |
| Entretien | — | Chimie (Standard / Premium) et contrat (Aucun, Essentiel, Confort, Premium) en cartes à choisir, avec délai d'intervention et coût mensuel | à dériver du kit |
| Catalogue | Showroom | Segment Portiques / Pistes HP, 3 gammes côte à côte ; ce qui ne rentre pas est grisé avec la raison | `ecrans/catalogue.svg` |
| Empire | Mur des stations | KPI, tri par CA ou par état, une capsule par station | `ecrans/empire.svg` |
| Banque | Guichet | Bilan sans cadre, courbe 60 jours, emprunt (montant, durée 3/5/7/10 ans, mensualité en direct), prêts en cours | `ecrans/banque.svg` |
| Équipe | Vestiaire | Embaucher, affecter, partager (3 stations max, même secteur), licencier | à dériver du kit |
| Missions | Tableau de liège | Titre, 9 objectifs (fait / en cours / récompense prête / verrouillé), rivaux, journal | `ecrans/missions.svg` |
| Réglages | Boîte à gants | Version, rythme, son, vibrations, export / import, nouvelle partie (confirmations intégrées) | à dériver du kit |

### 5.6 Pop-ups (moments forts)

Carte centrale de 320 px, coins 24 px, bandeau de couleur en haut selon le niveau, Bulle dans l'humeur adaptée.

| Moment | Bandeau | Bulle | Action principale (néon) | Référence |
|---|---|---|---|---|
| Panne | Rouge | `oups` | Voir la station | `ui/popup_panne.svg` |
| Parcelle voisine | Ambre, compte à rebours 20 j | `joie` | Racheter | `ui/popup_opp.svg` |
| Objectif atteint | Confettis, tampon « MISSION ACCOMPLIE » | `joie` | Continuer | `ui/popup_mission.svg` |
| Retour après absence | Ticket de caisse | — | Encaisser | `ui/popup_absence.svg` |
| Signal de zone, changement de palier, rival, alerte banque, faillite | à dériver | — | Voir… | CDC § Pop-ups |

Les petites nouvelles ne bloquent pas : elles vont dans la cloche.

## 6. Correspondance moteur → visuel

À brancher sur les états existants du moteur (noms à adapter à ceux du code) :

| Donnée moteur | Visuel |
|---|---|
| Équipement en marche / à l'arrêt | sprite `actif` (rouleaux, mousse, plaque néon) / `arret` |
| Équipement en panne + délai | sprite `panne` + picto critique + « N j » à côté |
| Fin de vie (seuil d'âge du moteur) | sprite `usure` (rouille, plaque orange) |
| Gamme | `eco` / `pro` / `premium` |
| File n / capacité | panneau de file dans la scène + indicateur ; picto critique et « COMPLET » quand n = capacité |
| Palier de zone 1 à 5 | `zone_palier_N` sur la carte, bâtiment d'arrière-plan dans la Station |
| Alertes | niveau → picto (§ 2), posé sur l'objet ; compteur sur la cloche |
| Prochaine action conseillée | un seul objet en néon (priorité suggérée : panne > file pleine > emplacement libre > étude > objectif) |

## 7. Animations (V1, sobres)

- **Gain :** pièce qui vole vers la trésorerie + « +N € » vert, 600 ms.
- **Néon de prochaine action :** pulsation douce du halo, 1,6 s en boucle.
- **Panne :** néon de plaque qui grésille (opacité saccadée), gyrophare qui tourne, fumée qui monte.
- **Client perdu :** voiture qui repart + petits traits de klaxon.
- **Ouverture de feuille :** glissement depuis le bas, 220 ms, voile sur le décor.
- **Performance :** halo par `filter: drop-shadow()` CSS sur 1 ou 2 éléments au plus ; pas de filtre SVG animé.
- **Accessibilité :** respecter `prefers-reduced-motion` (pulsations coupées, transitions instantanées).

## 8. Accessibilité et ergonomie

- Cibles de 44 px minimum ; actions principales dans le tiers bas ; rien d'important dans les coins hauts.
- Trois touches maximum pour toute action courante (acheter, changer un prix, réparer, emprunter).
- Zones sûres iOS (`env(safe-area-inset-*)`) respectées en haut et en bas.
- Contraste conforme à la règle du § 3 ; un état n'est jamais signalé par la seule couleur.

## 9. Plan de travail (un commit jouable par étape)

0. **Audit** du code existant : structure des écrans, états du moteur exposés, système de rendu. Rendre un court plan d'adaptation avant de modifier quoi que ce soit.
1. **Tokens et polices** : `tokens.css`, Google Fonts, styles de base (capsule, rond, feuille). Aucun changement de navigation.
2. **HUD haut et dock** : remplacent les onglets actuels, la navigation existante est rebranchée dessus. Cadran de vitesse branché sur le contrôle du temps du moteur.
3. **Écran Station** : diorama avec les sprites d'équipements et leurs états, objets touchables, indicateurs, bulle d'objectif.
4. **Feuilles** : Prix, Entretien, fiche équipement, Catalogue, avec pause automatique.
5. **Écran Monde** : carte, brouillard, zones, terrains, stations, rivaux, fiche Terrain et Reconnaissance.
6. **Empire, Banque, Équipe, Missions, Réglages.**
7. **Pop-ups et cloche d'alertes.**
8. **Onboarding** (CDC § Onboarding, 7 étapes avec Bulle et la main) et info-bulles de première fois.
9. **Animations** du § 7, puis passe de performance (poids < 2 Mo, fluidité sur iPhone).

Critère de fin de chaque étape : le jeu se lance, une partie existante se charge, on peut jouer de l'écran titre à la première vente.

## 10. Valeurs à vérifier avec le moteur

Les maquettes contiennent des valeurs d'illustration qui **ne viennent pas du CDC**. Elles doivent être remplacées par celles du moteur, jamais recopiées :

- prix des équipements (28 000 / 42 000 / 65 000 €), capacités, pannes par an, durées de vie ;
- prix des terrains, mensualités, parcelle voisine à 18 000 € ;
- liste et récompenses des 9 objectifs, titres de niveau intermédiaires ;
- règle « Premium = 2 emplacements » : supposée, à retirer si le moteur ne la prévoit pas ;
- noms de secteurs et de zones (Les Bruyères, Val-Ombré, Les Genêts…) : à aligner sur ceux du jeu.

Valeurs reprises du CDC : reconnaissance 2 000 €, étude 3 000 €, prix libres 1 à 40 €, file de 4 à 20, 2 à 8 emplacements, 6 secteurs, 5 paliers, compte à rebours de parcelle 20 jours, 3 stations max par employé partagé.

## 11. À ne pas faire

- Modifier le moteur, les règles ou le format de sauvegarde.
- Réintroduire des onglets, des listes plein écran ou des formulaires.
- Mettre un élément sombre qui ne se touche pas, ou plus de deux néons allumés en même temps.
- Afficher du texte néon clair sur fond blanc.
- Intégrer les écrans du dossier `ecrans/` comme images.
- Ajouter des dégradés violet-bleu ou un look « tableau de bord SaaS ».
