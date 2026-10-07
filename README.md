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
- **Villes vivantes** : auberge (recrues avec compétences, repos, rumeurs), marché, forge, tailleur, menuisier,
  palais ou caserne. Chaque bâtiment a son tenancier nommé ; on y entre par la porte (E).
- **Métiers et artisanat** : forge, couture, menuiserie, récolte. Les compétences montent avec la pratique et
  décident de la qualité (grossier, correct, bon, excellent). Ateliers constructibles dans tes exploitations.
- **Hiérarchie** : chaque faction a un souverain (au palais de sa capitale), des généraux qui mènent les armées,
  des capitaines de patrouille. Tous les PNJ ont un nom.
- **Escouade façon Kenshi** : prends le contrôle de n'importe quel membre (C ou clic sur son nom). Les membres
  tombent K.O. au lieu de mourir. Vue tactique (V) : sélection à la souris, clic droit pour déplacer ou attaquer.
- **Dangers** : hyènes, loups, ours, scorpions géants (plus nombreux la nuit), gibier à chasser pour la viande
  et le cuir, cannibales et brigands avec leurs repaires, tempêtes de sable dans le désert.
- **Combat** : parade automatique par défaut, combat directionnel en option. Arcs et flèches.
- **Équipement, fouille des corps, réputation, serment, sauvegarde.**

## Contrôles

| Action | Touche |
|---|---|
| Bouger | ZQSD ou WASD |
| Courir ou marcher (bascule) | Maj |
| Vue tactique / changer de perso | V / C |
| Caméra | Souris (clic pour la capturer, Échap pour la libérer), molette pour zoomer |
| Frapper / parer | Clic gauche / clic droit maintenu |
| Arc ou mêlée | X |
| Ville ou exploitation, fouiller, inventaire, carte | E, F, I, M |
| Ordres à l'escouade | 1 suivre · 2 charger · 3 tenir · 4 groupés · 5 attaquer ma cible |
| Temps accéléré, réglages | T, O |

## Code

- `js/data.js` : réglages, marchandises, biomes, ressources, objets, générateurs de noms
- `js/world.js` : génération du monde, relief, biomes, décor, drapeaux, villes, exploitations
- `js/units.js` : personnages, équipement, combat, IA
- `js/strategy.js` : groupes, guerres, événements mondiaux
- `js/economy.js` : stocks, prix, caravanes marchandes, civils
- `js/wildlife.js` : animaux sauvages, nuit, tempêtes de sable
- `js/ui.js` : interface, carte, inventaire, réglages, sauvegarde
- `js/main.js` : contrôles, caméra, boucle de jeu
