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
- **Villes vivantes** : bâtiments où l'on entre vraiment (le toit disparaît), auberge (recrues, lits, rumeurs),
  marché, bazar, forge, tailleur, menuisier, prison, palais ou caserne, maisons dont les habitants rentrent la nuit.
- **Prison et capture** : vaincu par une faction, tu finis en cellule, équipement confisqué dans un coffre.
  Les brigands te dépouillent, les cannibales t'enferment dans leur cage et te mangent si tu ne t'évades pas.
- **Crochetage et vol** : compétence, crochets, cellules et coffres à crocheter, témoins qui crient au voleur.
- **K.O., port des corps et primes** : les PNJ tombent souvent K.O. ; porte-les (G) et livre-les à une prison.
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
| Caméra (vue suivie) | ← → tourner, molette zoom, clic molette glisser |
| Dégainer / ranger l'arme | R |
| Porter un corps / soigner | G / H |
| Courir ou marcher (bascule) | Maj |
| Changer de caméra (suivie, tactique, épaule) / de perso | V / C |
| Caméra | Souris (clic pour la capturer, Échap pour la libérer), molette pour zoomer |
| Frapper / parer | Clic gauche / clic droit maintenu |
| Arc ou mêlée | X |
| Ville ou exploitation, fouiller, inventaire, carte | E, F, I, M |
| Ordres à l'escouade | 1 suivre · 2 charger · 3 tenir · 4 groupés · 5 attaquer ma cible |
| Temps accéléré, réglages | T, O |

## Code

- `js/data.js` : réglages, marchandises, biomes, ressources, objets, générateurs de noms
- `js/world.js` : génération du monde, relief, biomes, décor, drapeaux, exploitations
- `js/towns.js` : villes, bâtiments, murs, cellules, coffres
- `js/prison.js` : défaite, capture, prison, crochetage, port des corps, primes, soins
- `js/units.js` : personnages, équipement, combat, IA
- `js/strategy.js` : groupes, guerres, événements mondiaux
- `js/economy.js` : stocks, prix, caravanes marchandes, civils
- `js/wildlife.js` : animaux sauvages, nuit, tempêtes de sable
- `js/ui.js` : interface, carte, inventaire, réglages, sauvegarde
- `js/main.js` : contrôles, caméra, boucle de jeu
