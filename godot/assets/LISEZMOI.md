# Modèles et animations

Le jeu cherche automatiquement les fichiers ici :

- `assets/animations/` : un ou plusieurs fichiers `.glb` d'animations (ex. Quaternius
  « Universal Animation Library », licence CC0). Si le fichier contient aussi un
  mannequin, il sert de corps au personnage.
- `assets/characters/` : (facultatif) un `.glb` de personnage avec le même squelette
  (ex. Quaternius « Universal Base Characters », CC0). S'il est présent, il remplace
  le mannequin et reçoit les animations du dossier `animations/`.

Sans fichier, un mannequin provisoire (formes simples) est utilisé.

Les animations sont reconnues par leur nom (idle, walk, jog/run, sword_attack, hit, death…) :
voir `ANIM_RULES` dans `scripts/model_loader.gd`. La liste des animations trouvées
s'affiche dans la console « Sortie » de Godot au lancement.
