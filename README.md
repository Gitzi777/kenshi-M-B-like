# Terres Arides

Jeu bac à sable 3D à la 3e personne dans le navigateur, inspiré de **Kenshi** et **Mount & Blade**.

## Jouer

Lance un petit serveur dans le dossier (par exemple `python3 -m http.server`) puis ouvre http://localhost:8000.
Ouvert directement en double-cliquant, le jeu marche mais sans les modèles 3D détaillés (le navigateur bloque leur chargement).

## Contenu

- **Vrais modèles 3D animés** (licence CC0) : personnages KayKit (chevalier, barbare, aventurier, encapuchonné, mage) avec
  76 animations (marche, course, attaques, parade, esquive, coups reçus, K.O., mort, assis…), fondus entre les mouvements,
  tenues teintées aux couleurs de chaque faction. Arbres, pins, rochers, buissons, fleurs (Quaternius) et maisons
  médiévales à colombages assemblées pièce par pièce (Quaternius). Rendu « cel shading » doux avec lumière de contour.
- **Parler aux PNJ** (E) : nouvelles et rumeurs (figures redoutées, bandes proches, prix), directions, travail (primes sur
  des bandes, livraisons, chasse aux prédateurs), recrutement, menaces, pots-de-vin. Journal des tâches (J).
- **Ta faction et ta base** (B) : fonde ta faction (nom, couleurs, emblème), construis palissades, portes, tours de guet,
  maisons, forge, établis, entrepôt, champs, feux de camp et étendard. Toi et ton escouade construisez sur place.
  Engage des gardes. Les bandits peuvent piller ta base en ton absence.
- **Prendre des villes** : vaincs la garnison d'une ville ennemie puis appuie sur E pour la revendiquer. Tes villes paient
  un impôt chaque jour ; engage des gardes pour les tenir, car l'ancien maître voudra la reprendre.

- **Graphismes** : rendu « film » (tons ACES), ciel en dégradé avec soleil, nuages, étoiles et cycle jour/nuit coloré
  (aube, plein jour, coucher de soleil, nuit bleutée avec torche), brouillard d'horizon, ombres douces.
  Sol aux biomes fondus (roche dans les pentes, neige sur les sommets), routes de terre entre les villes,
  herbe dense et fleurs qui ondulent au vent, pins, feuillus, cactus, rochers irréguliers.
  Murs de pierre crénelés, tours coiffées, maisons enduites avec soubassement, poutres, fenêtres et toits de tuiles.
  Personnages plus détaillés (visage, cheveux, barbe, mains, bottes, ceinture), armes et casques métalliques.
  Interface refaite (thème cuir et laiton). Réglage de qualité graphique, et allègement automatique si l'image saccade.

- **Monde procédural** : chaque monde vient d'une graine. Relief, 5 biomes (désert, steppe, forêt, montagnes,
  marais salants), 3 ou 4 factions générées (nom, couleurs, drapeau, style de troupes), villes et camps.
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
- **Bandits variés** : pillards (dépouillent), rançonneurs (neutres, exigent un péage), esclavagistes
  (capturent et enferment dans leur camp), cannibales. Bandits et cannibales lancent des raids et peuvent
  prendre des villes ; les factions lèvent des armées pour les reprendre.
- **Esclavage** : certaines factions l'autorisent (marché aux esclaves : acheter, vendre des prisonniers
  ou des compagnons), d'autres l'interdisent.
- **Dangers** : hyènes, loups, ours, scorpions géants (plus nombreux la nuit, ils attaquent aussi les villageois), gibier à chasser pour la viande
  et le cuir, cannibales et brigands avec leurs repaires, tempêtes de sable dans le désert.
- **Combat** : parade, roulade d'esquive, combat à mains nues (les poings assomment au lieu de tuer), arcs.
  Pause à l'impact, tremblement de caméra, étincelles de parade, sang, poussière. Coups et flèches arrêtés par les murs.
  Option « frapper les neutres » (désactivée par défaut) pour ne pas déclencher de guerre par accident.
- **Compétences façon Kenshi** : attaque, défense, poings, tir, force, endurance, athlétisme, soins, artisanat…
  Elles montent en s'en servant jusqu'à 100, plus vite face à plus fort que soi.
- **Escouade autonome** : les membres se soignent et relèvent les blessés tout seuls quand le danger est passé.
- **Sons** : coups, parades, flèches, pas, oiseaux, grillons, rumeur des villes (synthétisés, aucun fichier).
- **Habitants persistants** : chaque PNJ a un nom, un métier, de l'argent, des compétences et du prestige, même hors de vue.
  Ils travaillent aux exploitations, tiennent et rachètent des boutiques, s'enrôlent dans la garnison, voyagent de ville en ville,
  se vendent comme mercenaires à la taverne, ou tournent brigands quand la misère frappe (onglet « Habitants » de l'auberge).
- **Prestige et grades** : les PNJ progressent en combattant (recrue, vétéran, sergent, champion ; pillard, lieutenant,
  seigneur de guerre). Les plus redoutés reçoivent un surnom, fondent leur propre bande, deviennent généraux.
- **Ouvriers et porteurs vulnérables** : bandits et ennemis les attaquent hors des villes, les soldats proches les défendent,
  et une exploitation sans ouvriers ne produit plus.
- **Garnisons réalistes** : pas de renforts pendant une attaque, les gardes assommés comptent comme perdus, la garnison
  se reconstitue avec les habitants qui s'enrôlent.
- **Monde plus stable** : guerres rares (une à la fois au plus), la paix revient.
- **Équipement, fouille des corps, réputation, serment, sauvegarde.**

## Contrôles

| Action | Touche |
|---|---|
| Avancer, reculer / tourner (vue suivie) | Z, S / Q, D (la caméra reste derrière toi) |
| Regarder autour / zoomer | Trackpad : 2 doigts ↔ / 2 doigts ↕ ou pincer · souris : flèches et molette |
| Parer | Espace maintenu (ou clic droit) |
| Esquiver (roulade) | ⌥ Option (Alt) |
| Achever un ennemi assommé | K |
| Dégainer / ranger l'arme | R |
| Porter un corps / soigner | G / H |
| Courir ou marcher (bascule) | Maj |
| Changer de caméra (suivie, tactique, épaule) / de perso | V / C |
| Frapper (vers le curseur) | Clic gauche |
| Arme, arc ou poings | X |
| Parler à quelqu'un, prendre une ville | E |
| Journal des tâches | J |
| Faction et construction | B (clic pour poser, R pour tourner, Échap pour annuler) |
| Ville ou exploitation, fouiller, inventaire, carte | E, F, I, M |
| Ordres à l'escouade | 1 suivre · 2 charger · 3 tenir · 4 groupés · 5 attaquer ma cible |
| Temps accéléré, réglages | T, O |

## Code

- `js/data.js` : réglages, marchandises, biomes, ressources, objets, générateurs de noms
- `js/world.js` : génération du monde, relief, biomes, décor, drapeaux, exploitations
- `js/towns.js` : villes, bâtiments, murs, cellules, coffres
- `js/prison.js` : défaite, capture, prison, crochetage, port des corps, primes, soins
- `js/gfx.js` : rendu, ciel, lumière du jour, textures, herbe, vent, routes
- `js/fx.js` : sons, particules, tremblement, pause à l'impact
- `js/units.js` : personnages, équipement, combat, IA
- `js/strategy.js` : groupes, guerres, événements mondiaux
- `js/economy.js` : stocks, prix, caravanes marchandes, civils
- `js/wildlife.js` : animaux sauvages, nuit, tempêtes de sable
- `js/people.js` : habitants persistants, métiers, prestige, grades, mercenaires, voyages
- `js/assets.js` : chargement des modèles 3D, personnages animés, maisons modulaires, végétation détaillée
- `js/talk.js` : dialogues, quêtes, journal
- `js/base.js` : ta faction, ta base, constructions, prise de villes
- `assets/` : modèles 3D CC0 (voir `assets/CREDITS.md`)
- `js/ui.js` : interface, carte, inventaire, réglages, sauvegarde
- `js/main.js` : contrôles, caméra, boucle de jeu
