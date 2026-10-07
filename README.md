# Terres Arides

Jeu bac à sable 3D à la 3e personne dans le navigateur, inspiré de **Kenshi** et **Mount & Blade**.

## Jouer

Ouvre `index.html` dans ton navigateur (connexion internet nécessaire pour charger Three.js).

## Contenu

- **Monde procédural** : chaque monde vient d'une graine. Relief, 5 biomes (désert, steppe, forêt, montagnes,
  marais salants), 4 à 6 factions générées (nom, couleurs, drapeau, style de troupes), villes et camps.
- **Ressources** : champs de céréales, camps de bûcherons, gisements de fer, plantations de coton et d'épices,
  salines, chacune dans son biome. Récolte à la main, rachète une exploitation ou revendique-la,
  et mets tes compagnons au travail.
- **Économie simulée** : chaque ville a une population, des stocks, une production et une consommation.
  Les prix suivent l'offre et la demande. Les caravanes achètent là où c'est moins cher et revendent ailleurs.
  Tes ventes font bouger les prix.
- **Vie visible** : ouvriers, porteurs qui livrent, marchands qui annoncent leurs prix, habitants qui achètent.
- **Monde vivant** : patrouilles, armées, sièges, guerres, paix, scissions, nouvelles factions, accidents, pénuries.
- **Combat** : parade automatique par défaut, combat directionnel en option. Arcs et flèches.
- **Escouade, équipement, fouille des corps, réputation, serment, sauvegarde.**

## Contrôles

| Action | Touche |
|---|---|
| Bouger / courir | ZQSD ou WASD / Maj |
| Caméra | Souris (clic pour la capturer, Échap pour la libérer), molette pour zoomer |
| Frapper / parer | Clic gauche / clic droit maintenu |
| Arc ou mêlée | X |
| Ville ou exploitation, fouiller, inventaire, carte | E, F, I, M |
| Ordres à l'escouade | 1 suivez-moi · 2 chargez · 3 tenez la position |
| Temps accéléré, réglages | T, O |

## Code

- `js/data.js` : réglages, marchandises, biomes, ressources, objets, générateurs de noms
- `js/world.js` : génération du monde, relief, biomes, décor, drapeaux, villes, exploitations
- `js/units.js` : personnages, équipement, combat, IA
- `js/strategy.js` : groupes, guerres, événements mondiaux
- `js/economy.js` : stocks, prix, caravanes marchandes, civils
- `js/ui.js` : interface, carte, inventaire, réglages, sauvegarde
- `js/main.js` : contrôles, caméra, boucle de jeu
