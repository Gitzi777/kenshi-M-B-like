# Terres Arides

Jeu 3D à la 3e personne dans le navigateur, inspiré de **Kenshi** et **Mount & Blade**.

## Jouer

Ouvre `index.html` dans ton navigateur (connexion internet nécessaire pour charger Three.js).

## Contenu

- **Création de perso** : nom, 5 origines, apparence, Force / Agilité / Endurance. Tu commences seul.
- **Lore** : l'Empire de Valmor s'est effondré il y a 60 ans. Ruines, histoire du monde, chroniques.
- **Factions** : Ligue Marchande, Clans de Fer, Saint Concile d'Ashara, Nomades du Vent, Chiens des Dunes.
  Chacune a son drapeau, ses tenues, ses troupes, son chef, sa devise et ses armuriers.
- **Monde vivant** : patrouilles, caravanes, armées qui assiègent des villes, villes qui changent de camp.
- **Événements mondiaux** : déclarations de guerre, paix, scissions de factions, nouvelles factions qui fondent
  leur camp, sécheresses, razzias. Tout est raconté dans les Chroniques.
- **Carte du monde (M)** : territoires, drapeaux, armées en marche, fiches des factions.
- **Combat directionnel** : la direction du coup et de la parade suit le mouvement de la souris. Arcs et flèches.
- **Équipement et inventaire (I)** : armes, arcs, armures, casques, visibles sur les personnages. Équipe aussi tes compagnons.
- **Fouille des corps (F)** et butin.
- **Réputation et serment** : prête allégeance à une faction, ses ennemis deviennent les tiens.
- **Sauvegarde** automatique (et bouton 💾), bouton « Continuer » au lancement.

## Contrôles

| Action | Touche |
|---|---|
| Bouger / courir | ZQSD ou WASD / Maj |
| Caméra et direction du coup | Souris (clic pour la capturer, Échap pour la libérer) |
| Frapper / parer | Clic gauche / clic droit maintenu |
| Arc ou mêlée | X |
| Ville, fouiller, inventaire, carte | E, F, I, M |
| Ordres à l'escouade | 1 suivez-moi · 2 chargez · 3 tenez la position |
| Temps accéléré | T |

## Code

- `js/data.js` : réglages, objets, factions, lore
- `js/world.js` : terrain, décor, drapeaux, villes
- `js/units.js` : personnages, équipement, combat, IA
- `js/strategy.js` : groupes, guerres, événements mondiaux
- `js/ui.js` : interface, carte, inventaire, sauvegarde
- `js/main.js` : contrôles et boucle de jeu
